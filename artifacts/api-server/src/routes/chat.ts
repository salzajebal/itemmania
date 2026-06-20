import { Router, type IRouter } from "express";
import { eq, and, or, lt } from "drizzle-orm";
import { db, chatRoomsTable, chatMessagesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// 내 채팅방 목록
router.get("/chat/rooms", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rooms = await db.select().from(chatRoomsTable).where(
    or(
      eq(chatRoomsTable.buyerId, userId),
      eq(chatRoomsTable.sellerId, userId),
    )
  );
  res.json(rooms.map(r => ({
    id: r.id,
    orderId: r.orderId,
    buyerId: r.buyerId,
    sellerId: r.sellerId,
    createdAt: r.createdAt,
  })));
});

// 메시지 목록 (페이지네이션: before 이전 50개)
router.get("/chat/rooms/:roomId/messages", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const roomId = parseInt(rawId, 10);
  const userId = req.session.userId!;
  const beforeId = req.query.before ? parseInt(String(req.query.before), 10) : undefined;

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) {
    res.status(404).json({ error: "채팅방을 찾을 수 없습니다." });
    return;
  }
  if (room.buyerId !== userId && room.sellerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "접근 권한이 없습니다." });
    return;
  }

  let query = db.select().from(chatMessagesTable).where(
    beforeId
      ? and(eq(chatMessagesTable.roomId, roomId), lt(chatMessagesTable.id, beforeId))
      : eq(chatMessagesTable.roomId, roomId)
  ).$dynamic();

  const messages = await query.limit(50);
  res.json(messages.map(m => ({
    id: m.id,
    roomId: m.roomId,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt,
  })));
});

// 메시지 전송
router.post("/chat/rooms/:roomId/messages", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const roomId = parseInt(rawId, 10);
  const userId = req.session.userId!;
  const { content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "메시지 내용을 입력하세요." });
    return;
  }

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) {
    res.status(404).json({ error: "채팅방을 찾을 수 없습니다." });
    return;
  }
  if (room.buyerId !== userId && room.sellerId !== userId) {
    res.status(403).json({ error: "접근 권한이 없습니다." });
    return;
  }

  const [message] = await db.insert(chatMessagesTable).values({
    roomId,
    senderId: userId,
    content: content.trim(),
  }).returning();

  res.status(201).json({
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
  });
});

export default router;
