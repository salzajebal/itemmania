import { pool } from "@workspace/db";

export class SupportError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type SupportSide = "member" | "admin";

export function supportId(value: unknown, allowZero = false): number {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) {
    throw new SupportError(400, "잘못된 문의 번호입니다.");
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < (allowZero ? 0 : 1) || n > 2147483647) {
    throw new SupportError(400, "잘못된 문의 번호입니다.");
  }
  return n;
}
export function supportInput(input: unknown): { body: string; clientId: string } {
  const { body, clientId } = (input ?? {}) as Record<string, unknown>;
  if (typeof body !== "string" || !body.trim() || body.trim().length > 2000 ||
      typeof clientId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(clientId)) {
    throw new SupportError(400, "메시지는 1~2,000자여야 하며 전송 번호가 필요합니다.");
  }
  return { body: body.trim(), clientId };
}
function message(row: Record<string, any>) {
  return { id: row.id, userId: row.user_id, sender: row.sender,
    senderName: row.sender === "admin" ? "고객센터" : row.nickname,
    body: row.body, createdAt: row.created_at };
}
export async function sendSupportMessage(userId: number, actorId: number, side: SupportSide, input: unknown) {
  const { body, clientId } = supportInput(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Match account archival's user-first lock order; cannot create messages after removal.
    const { rows: [owner] } = await client.query(
      "SELECT nickname,deleted_at,suspended_at FROM users WHERE id=$1 FOR KEY SHARE", [userId]);
    if (!owner) throw new SupportError(404, "회원을 찾을 수 없습니다.");
    if (owner.deleted_at || owner.suspended_at) throw new SupportError(409, "삭제되었거나 차단된 계정의 문의에는 메시지를 보낼 수 없습니다.");
    if (side === "member" && actorId !== userId) throw new SupportError(403, "본인의 문의만 작성할 수 있습니다.");
    if (side === "admin") {
      const { rows: [actor] } = await client.query(
        "SELECT role,deleted_at,suspended_at FROM users WHERE id=$1 FOR KEY SHARE", [actorId]);
      if (!actor || actor.role !== "admin" || actor.deleted_at || actor.suspended_at) throw new SupportError(403, "관리자 권한이 필요합니다.");
    }
    await client.query("INSERT INTO support_conversations(user_id) VALUES($1) ON CONFLICT DO NOTHING", [userId]);
    await client.query("SELECT user_id FROM support_conversations WHERE user_id=$1 FOR UPDATE", [userId]);
    const { rows: [existing] } = await client.query(
      "SELECT * FROM support_messages WHERE user_id=$1 AND sender=$2 AND client_id=$3", [userId, side, clientId]);
    if (existing) {
      if (existing.body !== body) throw new SupportError(409, "같은 전송 번호의 메시지 내용이 다릅니다.");
      await client.query("COMMIT");
      return message({ ...existing, nickname: owner.nickname });
    }
    const { rows: [generation] } = await client.query("SELECT coalesce(min(id),0)::int AS id FROM support_messages WHERE user_id=$1", [userId]);
    if ((input as Record<string, unknown>)?.expectedConversationId !== undefined &&
        supportId((input as Record<string, unknown>).expectedConversationId, true) !== generation.id) {
      throw new SupportError(409, "문의가 삭제되거나 새 대화로 변경되었습니다. 다시 확인해 주세요.");
    }
    const { rows: [rate] } = await client.query(`SELECT count(*)::int AS n FROM support_messages
      WHERE user_id=$1 AND sender=$2 AND created_at > now()-interval '5 seconds'`, [userId, side]);
    if (rate.n >= 10) throw new SupportError(429, "잠시 후 다시 전송해 주세요.");
    const { rows: [stored] } = await client.query(`INSERT INTO support_messages(user_id,sender,sender_id,body,client_id)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [userId, side, actorId, body, clientId]);
    await client.query(`UPDATE support_conversations SET last_message_id=$2,last_message_preview=$3,updated_at=now()
      WHERE user_id=$1`, [userId, stored.id, body.slice(0, 120)]);
    await client.query("COMMIT");
    return message({ ...stored, nickname: owner.nickname });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
export async function supportSummary(userId: number, side: SupportSide, query: Pick<typeof pool, "query"> = pool) {
  const readColumn = side === "member" ? "member_read_id" : "admin_read_id";
  const { rows: [row] } = await query.query(`SELECT c.last_message_id,
    (SELECT min(id) FROM support_messages WHERE user_id=c.user_id) AS conversation_id,
    (SELECT count(*)::int FROM support_messages m WHERE m.user_id=c.user_id AND m.sender=$2 AND m.id>c.${readColumn}) AS unread
    FROM support_conversations c WHERE user_id=$1`, [userId, side === "member" ? "admin" : "member"]);
  return { unreadCount: row?.unread ?? 0, latestMessageId: row?.last_message_id ?? 0, conversationId: row?.conversation_id ?? 0 };
}
export async function supportHistory(userId: number, side: SupportSide, afterId?: number, beforeId?: number) {
  const client = await pool.connect();
  try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows: [member] } = await client.query(
    "SELECT id,nickname,deleted_at,suspended_at FROM users WHERE id=$1", [userId]);
  if (!member) throw new SupportError(404, "회원을 찾을 수 없습니다.");
  const forward = afterId !== undefined;
  const cursor = afterId ?? beforeId;
  const { rows } = await client.query(`SELECT m.*,u.nickname FROM support_messages m
    JOIN users u ON u.id=m.user_id WHERE m.user_id=$1
    ${cursor === undefined ? "" : forward ? "AND m.id>$2" : "AND m.id<$2"}
    ORDER BY m.id ${forward ? "ASC" : "DESC"} LIMIT 101`, cursor === undefined ? [userId] : [userId, cursor]);
  const visible = rows.slice(0, 100);
  if (!forward) visible.reverse();
  const result = { messages: visible.map(message), hasMore: rows.length > 100,
    ...await supportSummary(userId, side, client),
    member: { id: member.id, nickname: member.nickname,
      deletedAt: member.deleted_at, suspendedAt: member.suspended_at } };
  await client.query("COMMIT");
  return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function readSupport(userId: number, side: SupportSide, id: number) {
  if (id === 0) return false;
  const column = side === "member" ? "member_read_id" : "admin_read_id";
  const result = await pool.query(`UPDATE support_conversations SET ${column}=GREATEST(${column},$2)
    WHERE user_id=$1 AND ${column}<$2 AND EXISTS(SELECT 1 FROM support_messages WHERE user_id=$1 AND id=$2) RETURNING user_id`, [userId, id]);
  if (!result.rowCount) {
    const { rowCount } = await pool.query("SELECT id FROM support_messages WHERE user_id=$1 AND id=$2", [userId, id]);
    if (!rowCount) throw new SupportError(400, "이 문의의 메시지가 아닙니다.");
  }
  return !!result.rowCount;
}
export async function supportConversations(limit: number, beforeId?: number) {
  const { rows: [latest] } = await pool.query("SELECT coalesce(max(id),0)::int AS id FROM support_messages WHERE sender='member'");
  const { rows } = await pool.query(`SELECT c.*,u.nickname,u.email,u.deleted_at,u.suspended_at,
    (SELECT max(id) FROM support_messages WHERE user_id=c.user_id AND sender='member') AS latest_member_id,
    (SELECT count(*)::int FROM support_messages m WHERE m.user_id=c.user_id AND m.sender='member' AND m.id>c.admin_read_id) AS unread
    FROM support_conversations c JOIN users u ON u.id=c.user_id
    WHERE c.last_message_id>0 ${beforeId === undefined ? "" : "AND c.last_message_id<$2"}
    ORDER BY c.last_message_id DESC LIMIT $1`, beforeId === undefined ? [limit + 1] : [limit + 1, beforeId]);
  return { latestMemberMessageId: latest.id, conversations: rows.slice(0, limit).map(row => ({
    userId: row.user_id, nickname: row.nickname, email: row.email, deletedAt: row.deleted_at, suspendedAt: row.suspended_at,
    lastMessageId: row.last_message_id, lastMessagePreview: row.last_message_preview,
    latestMemberMessageId: row.latest_member_id ?? 0,
    updatedAt: row.updated_at, unreadCount: row.unread,
  })), hasMore: rows.length > limit };
}

export async function deleteSupportConversation(userId: number, actorId: number, expectedLastMessageId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR KEY SHARE", [userId]);
    const { rows: [actor] } = await client.query("SELECT role,deleted_at,suspended_at FROM users WHERE id=$1 FOR KEY SHARE", [actorId]);
    if (!actor || actor.role !== "admin" || actor.deleted_at || actor.suspended_at) throw new SupportError(403, "관리자 권한이 필요합니다.");
    const { rows: [conversation] } = await client.query("SELECT last_message_id FROM support_conversations WHERE user_id=$1 FOR UPDATE", [userId]);
    if (conversation && conversation.last_message_id !== expectedLastMessageId) {
      throw new SupportError(409, "새 메시지가 도착했습니다. 대화를 다시 확인한 후 삭제해 주세요.");
    }
    const deleted = await client.query("DELETE FROM support_messages WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM support_conversations WHERE user_id=$1", [userId]);
    await client.query("COMMIT");
    return { ok: true, deletedMessages: deleted.rowCount ?? 0 };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
