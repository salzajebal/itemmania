import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { supportInput, supportId, sendSupportMessage, supportHistory, supportSummary,
  supportConversations, readSupport, SupportError, deleteSupportConversation } from "./support-chat";

after(() => pool.end());
test("support storage: private ownership, retry safety, paging, read watermarks and archived history", async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  for (const bad of ["", "   ", "x".repeat(2001), null]) {
    assert.throws(() => supportInput({ body: bad, clientId: "safe" }), SupportError);
  }
  for (const bad of [null, "", -1, 1.5, "2e2", ["1"]]) assert.throws(() => supportId(bad), SupportError);
  const key = randomUUID();
  const { rows: accounts } = await pool.query(`INSERT INTO users(email,nickname,password_hash)
    VALUES($1,'QA support A','synthetic-no-login'),($2,'QA support B','synthetic-no-login') RETURNING id`,
  [`support-${key}-a`, `support-${key}-b`]);
  const [a, b] = accounts.map(v => v.id);
  const { rows: [admin] } = await pool.query("SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL ORDER BY id LIMIT 1");
  try {
    const first = await sendSupportMessage(a, a, "member", { body: "<b>literal text</b>", clientId: "first" });
    const retries = await Promise.all([1, 2, 3].map(() =>
      sendSupportMessage(a, a, "member", { body: "<b>literal text</b>", clientId: "first" })));
    assert.ok(retries.every(m => m.id === first.id));
    await assert.rejects(sendSupportMessage(a, a, "member", { body: "different", clientId: "first" }),
      (e: unknown) => e instanceof SupportError && e.status === 409);
    await assert.rejects(sendSupportMessage(a, b, "member", { body: "spoof", clientId: "bad" }),
      (e: unknown) => e instanceof SupportError && e.status === 403);
    await assert.rejects(sendSupportMessage(a, b, "admin", { body: "spoof", clientId: "bad" }),
      (e: unknown) => e instanceof SupportError && e.status === 403);
    const ownB = await sendSupportMessage(b, b, "member", { body: "private B", clientId: "b" });
    assert.equal((await supportHistory(b, "member")).messages.length, 1);
    assert.equal((await supportHistory(b, "member")).messages[0].body, "private B");
    assert.equal((await supportSummary(a, "admin")).unreadCount, 1);
    assert.equal(await readSupport(a, "admin", first.id), true);
    assert.equal(await readSupport(a, "admin", first.id), false);
    assert.equal((await supportSummary(a, "admin")).unreadCount, 0);
    await assert.rejects(readSupport(a, "member", ownB.id), SupportError);
    const reply = await sendSupportMessage(a, admin.id, "admin", { body: "operator reply", clientId: "reply" });
    assert.equal((await supportSummary(a, "member")).unreadCount, 1);
    assert.equal((await supportHistory(a, "member")).messages[1].senderName, "고객센터");
    await readSupport(a, "member", reply.id);
    assert.equal((await supportSummary(a, "member")).unreadCount, 0);
    // Bulk history fixture avoids rate limiting without weakening the real send path.
    await pool.query(`INSERT INTO support_messages(user_id,sender,sender_id,body,client_id)
      SELECT $1,'member',$1,'history '||n,'fixture-'||n FROM generate_series(1,115) n`, [a]);
    await pool.query(`UPDATE support_conversations SET last_message_id=(SELECT max(id) FROM support_messages WHERE user_id=$1)
      WHERE user_id=$1`, [a]);
    const latest = await supportHistory(a, "member");
    assert.equal(latest.messages.length, 100);
    assert.equal(latest.hasMore, true);
    const earlier = await supportHistory(a, "member", undefined, latest.messages[0].id);
    assert.equal(earlier.messages.length, 17);
    assert.equal(earlier.hasMore, false);
    const forward = await supportHistory(a, "member", first.id);
    assert.equal(forward.hasMore, true);
    assert.ok(forward.messages.every(m => m.id > first.id));
    const inbox = await supportConversations(100);
    assert.ok(inbox.conversations.some(c => c.userId === a));
    assert.ok(inbox.conversations.some(c => c.userId === b));
    assert.equal((await supportConversations(1)).hasMore, true);
    await pool.query("UPDATE users SET deleted_at=now() WHERE id=$1", [a]);
    await assert.rejects(sendSupportMessage(a, admin.id, "admin", { body: "no", clientId: "archived" }),
      (e: unknown) => e instanceof SupportError && e.status === 409);
    assert.equal((await supportHistory(a, "admin")).messages.length, 100);
    const before = await pool.query("SELECT (SELECT count(*) FROM orders) AS orders,(SELECT count(*) FROM chat_messages) AS messages,(SELECT count(*) FROM wallets) AS wallets");
    const last = (await supportSummary(a, "admin")).latestMessageId;
    await assert.rejects(deleteSupportConversation(a, b, last), (e: unknown) => e instanceof SupportError && e.status === 403);
    await assert.rejects(deleteSupportConversation(a, admin.id, first.id), (e: unknown) => e instanceof SupportError && e.status === 409);
    assert.equal((await supportHistory(a, "admin")).messages.length, 100);
    assert.equal((await deleteSupportConversation(a, admin.id, last)).deletedMessages, 117);
    assert.equal((await supportHistory(a, "member")).messages.length, 0);
    assert.equal((await supportSummary(a, "member")).conversationId, 0);
    assert.equal((await supportHistory(b, "member")).messages[0].body, "private B");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM support_conversations WHERE user_id=$1", [a])).rows[0].n, 0);
    await pool.query("UPDATE users SET deleted_at=NULL WHERE id=$1", [a]);
    await assert.rejects(sendSupportMessage(a, a, "member", { body: "stale retry", clientId: "retry", expectedConversationId: first.id }),
      (e: unknown) => e instanceof SupportError && e.status === 409);
    const fresh = await sendSupportMessage(a, a, "member", { body: "fresh inquiry", clientId: "fresh", expectedConversationId: 0 });
    assert.equal((await supportSummary(a, "admin")).conversationId, fresh.id);
    assert.equal((await supportHistory(a, "member")).messages.length, 1);
    assert.deepEqual((await pool.query("SELECT (SELECT count(*) FROM orders) AS orders,(SELECT count(*) FROM chat_messages) AS messages,(SELECT count(*) FROM wallets) AS wallets")).rows, before.rows);
  } finally {
    await pool.query("DELETE FROM support_messages WHERE user_id=ANY($1::int[])", [[a, b]]);
    await pool.query("DELETE FROM support_conversations WHERE user_id=ANY($1::int[])", [[a, b]]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [[a, b]]);
  }
});
