import { Router, type IRouter } from "express";
import { eq, and, or, lt, desc, sql } from "drizzle-orm";
import { db, chatRoomsTable, chatMessagesTable, usersTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// 내 채팅방 목록 (참여자 닉네임, 상품명, 마지막 메시지 포함)
router.get("/chat/rooms", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const rooms = await db
    .select({
      id: chatRoomsTable.id,
      buyerId: chatRoomsTable.buyerId,
      sellerId: chatRoomsTable.sellerId,
      productId: chatRoomsTable.productId,
      orderId: chatRoomsTable.orderId,
      createdAt: chatRoomsTable.createdAt,
      buyerNickname: sql<string>`buyer.nickname`.as("buyerNickname"),
      sellerNickname: sql<string>`seller.nickname`.as("sellerNickname"),
    })
    .from(chatRoomsTable)
    .leftJoin(sql`users buyer`, sql`buyer.id = ${chatRoomsTable.buyerId}`)
    .leftJoin(sql`users seller`, sql`seller.id = ${chatRoomsTable.sellerId}`)
    .where(
      or(
        eq(chatRoomsTable.buyerId, userId),
        eq(chatRoomsTable.sellerId, userId),
      )
    );

  // 각 방의 마지막 메시지 + 상품명 수집
  const enriched = await Promise.all(rooms.map(async (r) => {
    const [lastMsg] = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.roomId, r.id))
      .orderBy(desc(chatMessagesTable.id))
      .limit(1);

    let productTitle: string | null = null;
    if (r.productId) {
      const [prod] = await db.select({ title: productsTable.title }).from(productsTable).where(eq(productsTable.id, r.productId));
      productTitle = prod?.title ?? null;
    }

    return {
      id: r.id,
      buyerId: r.buyerId,
      sellerId: r.sellerId,
      productId: r.productId,
      orderId: r.orderId,
      buyerNickname: r.buyerNickname,
      sellerNickname: r.sellerNickname,
      productTitle,
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.createdAt ?? r.createdAt,
      createdAt: r.createdAt,
    };
  }));

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

  // 기존 방 탐색 (같은 buyer + seller + product 조합)
  const conditions = [
    eq(chatRoomsTable.buyerId, userId),
    eq(chatRoomsTable.sellerId, sellerId),
  ];
  if (productId) {
    conditions.push(eq(chatRoomsTable.productId, productId));
  }

  const [existing] = await db
    .select()
    .from(chatRoomsTable)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    res.json({ id: existing.id, created: false });
    return;
  }

  const [room] = await db
    .insert(chatRoomsTable)
    .values({
      buyerId: userId,
      sellerId,
      productId: productId ?? null,
    })
    .returning();

  res.status(201).json({ id: room.id, created: true });
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

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(
      beforeId
        ? and(eq(chatMessagesTable.roomId, roomId), lt(chatMessagesTable.id, beforeId))
        : eq(chatMessagesTable.roomId, roomId)
    )
    .orderBy(chatMessagesTable.id)
    .limit(50);

  // 방 메타 포함
  const [buyer] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, room.buyerId));
  const [seller] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, room.sellerId));

  let productTitle: string | null = null;
  if (room.productId) {
    const [prod] = await db.select({ title: productsTable.title }).from(productsTable).where(eq(productsTable.id, room.productId));
    productTitle = prod?.title ?? null;
  }

  res.json({
    room: {
      id: room.id,
      buyerId: room.buyerId,
      sellerId: room.sellerId,
      productId: room.productId,
      productTitle,
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
