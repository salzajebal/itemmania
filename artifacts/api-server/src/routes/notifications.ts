import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { pushToUser } from "../lib/sse";

const router: IRouter = Router();

// 알림 생성 헬퍼 (내부 사용)
export async function createNotification(
  userId: number,
  type: "chat_message" | "trade_handover" | "trade_ended" | "trade_cancelled" | "system",
  title: string,
  options?: { body?: string; link?: string }
): Promise<void> {
  const [notif] = await db
    .insert(notificationsTable)
    .values({ userId, type, title, body: options?.body ?? null, link: options?.link ?? null })
    .returning();
  pushToUser(userId, "notification", {
    id: notif.id,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    link: notif.link,
    createdAt: notif.createdAt,
  });
}

// 모든 어드민에게 알림 전송 (내부 사용)
export async function notifyAdmin(
  title: string,
  options?: { body?: string; link?: string }
): Promise<void> {
  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  await Promise.all(admins.map(a => createNotification(a.id, "system", title, options)));
}

// 내 알림 목록 (최근 30개)
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(30);

  const unreadCount = rows.filter(r => !r.isRead).length;
  res.json({ notifications: rows, unreadCount });
});

// 단일 알림 읽음 처리
router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id as string, 10);
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
  res.json({ ok: true });
});

// 전체 읽음 처리
router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});

export default router;
