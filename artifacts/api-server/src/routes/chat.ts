import { Router, type IRouter } from "express";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { db, chatRoomsTable, chatMessagesTable, usersTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function enrichRoom(r: typeof chatRoomsTable.$inferSelect) {
  const [lastMsg] = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.roomId, r.id))
    .orderBy(desc(chatMessagesTable.id))
    .limit(1);

  const [buyer] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, r.buyerId));
  const [seller] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, r.sellerId));

  let productTitle: string | null = null;
  let productPrice: number | null = null;
  if (r.productId) {
    const [prod] = await db.select({ title: productsTable.title, price: productsTable.price }).from(productsTable).where(eq(productsTable.id, r.productId));
    productTitle = prod?.title ?? null;
    productPrice = prod?.price ?? null;
  }

  return {
    id: r.id,
    buyerId: r.buyerId,
    sellerId: r.sellerId,
    productId: r.productId,
    orderId: r.orderId,
    status: r.status,
    buyerNickname: buyer?.nickname ?? String(r.buyerId),
    sellerNickname: seller?.nickname ?? String(r.sellerId),
    productTitle,
    productPrice,
    lastMessage: lastMsg?.content ?? null,
    lastMessageAt: lastMsg?.createdAt ?? r.createdAt,
    createdAt: r.createdAt,
  };
}

// 내 채팅방 목록
router.get("/chat/rooms", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const rooms = await db
    .select()
    .from(chatRoomsTable)
    .where(or(eq(chatRoomsTable.buyerId, userId), eq(chatRoomsTable.sellerId, userId)));

  const enriched = await Promise.all(rooms.map(enrichRoom));
  res.json(enriched);
});

// 채팅방 생성 또는 기존 방 반환
router.post("/chat/rooms", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { sellerId, productId } = req.body as { sellerId?: number; productId?: number };

  if (!sellerId || typeof sellerId !== "number") {
    res.status(400).json({ error: "sellerId가 필요합니다." });
    return;
  }
  if (sellerId === userId) {
    res.status(400).json({ error: "자신과 채팅할 수 없습니다." });
    return;
  }

  const conditions = [eq(chatRoomsTable.buyerId, userId), eq(chatRoomsTable.sellerId, sellerId)];
  if (productId) conditions.push(eq(chatRoomsTable.productId, productId));

  const [existing] = await db.select().from(chatRoomsTable).where(and(...conditions)).limit(1);
  if (existing) {
    res.json({ id: existing.id, created: false });
    return;
  }

  const [room] = await db
    .insert(chatRoomsTable)
    .values({ buyerId: userId, sellerId, productId: productId ?? null })
    .returning();

  res.status(201).json({ id: room.id, created: true });
});

// 채팅방 상태 변경
router.patch("/chat/rooms/:roomId", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId as string, 10);
  const userId = req.session.userId!;
  const { status } = req.body as { status?: string };

  const validStatuses = ["pending", "active", "ended", "cancelled", "rejected"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: "유효하지 않은 상태값입니다." });
    return;
  }

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
  if (room.buyerId !== userId && room.sellerId !== userId) {
    res.status(403).json({ error: "접근 권한이 없습니다." }); return;
  }

  await db.update(chatRoomsTable).set({ status }).where(eq(chatRoomsTable.id, roomId));
  res.json({ id: roomId, status });
});

// 메시지 목록
router.get("/chat/rooms/:roomId/messages", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId as string, 10);
  const userId = req.session.userId!;
  const beforeId = req.query.before ? parseInt(String(req.query.before), 10) : undefined;

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
  if (room.buyerId !== userId && room.sellerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "접근 권한이 없습니다." }); return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(beforeId
      ? and(eq(chatMessagesTable.roomId, roomId), lt(chatMessagesTable.id, beforeId))
      : eq(chatMessagesTable.roomId, roomId))
    .orderBy(chatMessagesTable.id)
    .limit(50);

  const [buyer] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, room.buyerId));
  const [seller] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, room.sellerId));

  let productTitle: string | null = null;
  let productPrice: number | null = null;
  if (room.productId) {
    const [prod] = await db.select({ title: productsTable.title, price: productsTable.price }).from(productsTable).where(eq(productsTable.id, room.productId));
    productTitle = prod?.title ?? null;
    productPrice = prod?.price ?? null;
  }

  res.json({
    room: {
      id: room.id,
      buyerId: room.buyerId,
      sellerId: room.sellerId,
      productId: room.productId,
      status: room.status,
      productTitle,
      productPrice,
      buyerNickname: buyer?.nickname ?? String(room.buyerId),
      sellerNickname: seller?.nickname ?? String(room.sellerId),
    },
    messages: messages.map(m => ({
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
});

// 메시지 전송
router.post("/chat/rooms/:roomId/messages", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId as string, 10);
  const userId = req.session.userId!;
  const { content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "메시지 내용을 입력하세요." }); return;
  }

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
  if (room.buyerId !== userId && room.sellerId !== userId) {
    res.status(403).json({ error: "접근 권한이 없습니다." }); return;
  }

  // 첫 메시지 → 거래대기에서 거래중으로 자동 전환
  if (room.status === "pending") {
    await db.update(chatRoomsTable).set({ status: "active" }).where(eq(chatRoomsTable.id, roomId));
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
