import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { Router, type IRouter } from "express";
import { eq, and, or, ne, lt, desc, sql } from "drizzle-orm";
import { db, chatRoomsTable, chatMessagesTable, usersTable, productsTable, walletsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { pushToUser } from "../lib/sse";
import { createNotification } from "./notifications";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "..", "..", "uploads", "chat-images");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    } else {
      cb(null, true);
    }
  },
});

const router: IRouter = Router();

async function enrichRoom(r: typeof chatRoomsTable.$inferSelect) {
  const [lastMsg] = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.roomId, r.id))
    .orderBy(desc(chatMessagesTable.id))
    .limit(1);

  const [buyer] = await db.select({ nickname: usersTable.nickname, email: usersTable.email, grade: usersTable.grade }).from(usersTable).where(eq(usersTable.id, r.buyerId));
  const [seller] = await db.select({ nickname: usersTable.nickname, email: usersTable.email, grade: usersTable.grade }).from(usersTable).where(eq(usersTable.id, r.sellerId));

  let productTitle: string | null = null;
  let productPrice: number | null = null;
  let gameName: string | null = null;
  let serverName: string | null = null;
  let itemCategory: string | null = null;
  if (r.productId) {
    const [prod] = await db.select({ title: productsTable.title, price: productsTable.price, gameName: productsTable.gameName, serverName: productsTable.serverName, itemCategory: productsTable.itemCategory }).from(productsTable).where(eq(productsTable.id, r.productId));
    productTitle = prod?.title ?? null;
    productPrice = prod?.price ?? null;
    gameName = prod?.gameName ?? null;
    serverName = prod?.serverName ?? null;
    itemCategory = prod?.itemCategory ?? null;
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
    buyerEmail: buyer?.email ?? null,
    sellerEmail: seller?.email ?? null,
    buyerGrade: buyer?.grade ?? null,
    sellerGrade: seller?.grade ?? null,
    productTitle,
    productPrice,
    gameName,
    serverName,
    itemCategory,
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
    .where(
      and(
        or(eq(chatRoomsTable.buyerId, userId), eq(chatRoomsTable.sellerId, userId)),
        ne(chatRoomsTable.status, "cancelled")
      )
    );

  const enriched = await Promise.all(rooms.map(enrichRoom));
  res.json(enriched);
});

// 채팅방 생성 또는 기존 방 반환
router.post("/chat/rooms", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { sellerId, buyerId, productId, characterName, goodsType } = req.body as {
    sellerId?: number; buyerId?: number; productId?: number; characterName?: string; goodsType?: string;
  };

  // sellerId가 오면 "내가 구매자" (판매글에서 채팅), buyerId가 오면 "내가 판매자" (구매글에서 채팅)
  let resolvedBuyerId: number;
  let resolvedSellerId: number;
  if (sellerId && typeof sellerId === "number") {
    resolvedBuyerId = userId;
    resolvedSellerId = sellerId;
  } else if (buyerId && typeof buyerId === "number") {
    resolvedBuyerId = buyerId;
    resolvedSellerId = userId;
  } else {
    res.status(400).json({ error: "sellerId 또는 buyerId가 필요합니다." });
    return;
  }

  if (resolvedBuyerId === resolvedSellerId) {
    res.status(400).json({ error: "자신과 채팅할 수 없습니다." });
    return;
  }

  const conditions = [eq(chatRoomsTable.buyerId, resolvedBuyerId), eq(chatRoomsTable.sellerId, resolvedSellerId)];
  if (productId) conditions.push(eq(chatRoomsTable.productId, productId));

  const [existing] = await db.select().from(chatRoomsTable).where(and(...conditions)).limit(1);
  if (existing) {
    // 종료/취소/불가 상태 방은 재사용하지 않고 새 방 생성
    const closedStatuses = ["ended", "cancelled", "rejected"];
    if (!closedStatuses.includes(existing.status)) {
      if (characterName && !existing.characterName) {
        await db.update(chatRoomsTable).set({ characterName, goodsType: goodsType ?? null }).where(eq(chatRoomsTable.id, existing.id));
      }
      res.json({ id: existing.id, created: false });
      return;
    }
  }

  const [room] = await db
    .insert(chatRoomsTable)
    .values({
      buyerId: resolvedBuyerId, sellerId: resolvedSellerId, productId: productId ?? null,
      characterName: characterName ?? null, goodsType: goodsType ?? null,
    })
    .returning();

  res.status(201).json({ id: room.id, created: true });
});

// 채팅방 상태 변경
router.patch("/chat/rooms/:roomId", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId as string, 10);
  const userId = req.session.userId!;
  const { status } = req.body as { status?: string };

  const validStatuses = ["pending", "active", "handover", "ended", "cancelled", "rejected"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: "유효하지 않은 상태값입니다." });
    return;
  }

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
  if (room.buyerId !== userId && room.sellerId !== userId) {
    res.status(403).json({ error: "접근 권한이 없습니다." }); return;
  }

  // 인계하기: 판매자만 가능
  if (status === "handover" && userId !== room.sellerId) {
    res.status(403).json({ error: "판매자만 인계하기를 할 수 있습니다." }); return;
  }
  // 거래완료(인수확인): 구매자만 가능
  if (status === "ended" && userId !== room.buyerId) {
    res.status(403).json({ error: "구매자만 거래완료를 할 수 있습니다." }); return;
  }
  // 채팅취소: 판매자 또는 구매자 모두 가능
  // (cancelled는 별도 제한 없음)

  await db.update(chatRoomsTable).set({ status }).where(eq(chatRoomsTable.id, roomId));

  // 판매자가 인계하기 → 구매자에게 실시간 알림 (인수확인 버튼 활성화)
  if (status === "handover") {
    pushToUser(room.buyerId, "chat_handover", { roomId });
    await createNotification(room.buyerId, "trade_handover", "아이템 인계 완료", {
      body: "판매자가 아이템을 인계했습니다. 인수확인을 진행해 주세요.",
      link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
    });
  }

  // 거래 취소
  if (status === "cancelled") {
    const otherId = userId === room.buyerId ? room.sellerId : room.buyerId;
    await createNotification(otherId, "trade_cancelled", "거래가 취소되었습니다", {
      body: "상대방이 거래를 취소했습니다.",
      link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
    });
  }

  // 구매자가 인수하기(ended) 처리 → 판매자에게 거래금액 마일리지 지급
  if (status === "ended" && userId === room.buyerId && room.productId) {
    const [prod] = await db
      .select({ price: productsTable.price })
      .from(productsTable)
      .where(eq(productsTable.id, room.productId));

    if (prod?.price) {
      const price = Number(prod.price);
      // 판매자 지갑 upsert: 없으면 생성, 있으면 잔액 추가
      const [existing] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, room.sellerId));

      let newBalance: number;
      if (existing) {
        const [updated] = await db
          .update(walletsTable)
          .set({ balance: sql`${walletsTable.balance} + ${price}` })
          .where(eq(walletsTable.userId, room.sellerId))
          .returning();
        newBalance = Number(updated.balance);
      } else {
        const [created] = await db
          .insert(walletsTable)
          .values({ userId: room.sellerId, balance: price })
          .returning();
        newBalance = Number(created.balance);
      }

      // SSE로 판매자 마이룸에 실시간 반영
      pushToUser(room.sellerId, "balance", { balance: newBalance });
      await createNotification(room.sellerId, "trade_ended", "거래가 완료되었습니다", {
        body: `마일리지 ${Number(prod.price).toLocaleString("ko-KR")}원이 지급되었습니다.`,
        link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
      });
    }
  }

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

  const [buyer] = await db.select({ nickname: usersTable.nickname, name: usersTable.name, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, room.buyerId));
  const [seller] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, room.sellerId));

  let productTitle: string | null = null;
  let productPrice: number | null = null;
  if (room.productId) {
    const [prod] = await db.select({ title: productsTable.title, price: productsTable.price }).from(productsTable).where(eq(productsTable.id, room.productId));
    productTitle = prod?.title ?? null;
    productPrice = prod?.price ?? null;
  }

  // 구매자 실명/전화번호: 판매자 또는 어드민에게만 노출
  const isSeller = userId === room.sellerId || req.session.userRole === "admin";
  const buyerName = isSeller ? (buyer?.name ?? null) : null;
  const buyerPhone = isSeller ? (buyer?.phone ?? null) : null;

  res.json({
    room: {
      id: room.id,
      buyerId: room.buyerId,
      sellerId: room.sellerId,
      productId: room.productId,
      status: room.status,
      productTitle,
      productPrice,
      characterName: room.characterName ?? null,
      goodsType: room.goodsType ?? null,
      buyerNickname: buyer?.nickname ?? String(room.buyerId),
      sellerNickname: seller?.nickname ?? String(room.sellerId),
      buyerName,
      buyerPhone,
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

// 이미지 업로드
router.post("/chat/rooms/:roomId/upload", requireAuth, upload.single("image"), async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId as string, 10);
  const userId = req.session.userId!;

  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
  if (room.buyerId !== userId && room.sellerId !== userId) {
    res.status(403).json({ error: "접근 권한이 없습니다." }); return;
  }
  if (!req.file) { res.status(400).json({ error: "이미지를 선택하세요." }); return; }

  const imageUrl = `/chat-images/${req.file.filename}`;

  if (room.status === "pending") {
    await db.update(chatRoomsTable).set({ status: "active" }).where(eq(chatRoomsTable.id, roomId));
  }

  const content = `[img]${imageUrl}`;
  const [message] = await db.insert(chatMessagesTable).values({ roomId, senderId: userId, content }).returning();

  // 상대방에게 채팅 알림
  const uploadRecipientId = userId === room.buyerId ? room.sellerId : room.buyerId;
  const [uploadSender] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, userId));
  await createNotification(uploadRecipientId, "chat_message", `${uploadSender?.nickname ?? "상대방"}님의 메시지`, {
    body: "📷 사진을 보냈습니다.",
    link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
  });

  res.status(201).json({
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
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

  // 상대방에게 채팅 알림 전송
  const recipientId = userId === room.buyerId ? room.sellerId : room.buyerId;
  const [sender] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, userId));
  const senderName = sender?.nickname ?? "상대방";
  const preview = content.trim().startsWith("[img]") ? "📷 사진을 보냈습니다." : (content.trim().length > 30 ? content.trim().slice(0, 30) + "…" : content.trim());
  await createNotification(recipientId, "chat_message", `${senderName}님의 메시지`, {
    body: preview,
    link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
  });

  res.status(201).json({
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
  });
});

export default router;
