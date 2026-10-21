import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { Router, type IRouter } from "express";
import { eq, and, or, ne, lt, desc, sql, gte, isNull } from "drizzle-orm";
import { db, chatRoomsTable, chatMessagesTable, usersTable, productsTable, walletsTable, ordersTable, escrowLedgerTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { pushToUser } from "../lib/sse";
import { createNotification, notifyAdmin } from "./notifications";
import { localProductSellerId } from "./product-ownership";
import { normalizeTradeCharacterName, tradeCharacterNames, publicListingDescription } from "../lib/trade-character-names";
import { chatTradeInfo } from "../lib/chat-trade-info";

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
        req.query.includeDismissed === "1" ? or(eq(chatRoomsTable.buyerId, userId), eq(chatRoomsTable.sellerId, userId)) : or(
          and(eq(chatRoomsTable.buyerId, userId), isNull(chatRoomsTable.buyerDismissedAt)),
          and(eq(chatRoomsTable.sellerId, userId), isNull(chatRoomsTable.sellerDismissedAt))
        ),
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

  if (productId !== undefined && (!Number.isSafeInteger(productId) || productId < 1)) {
    res.status(400).json({ error: "잘못된 상품 ID입니다." });
    return;
  }

  let result: { room: typeof chatRoomsTable.$inferSelect; created: boolean };
  try {
    const applicantCharacterName = normalizeTradeCharacterName(characterName);
    result = await db.transaction(async tx => {
      const participants = await tx.select({ id: usersTable.id }).from(usersTable)
        .where(and(sql`${usersTable.id} IN (${resolvedBuyerId}, ${resolvedSellerId})`, isNull(usersTable.deletedAt)))
        .for("key share");
      if (participants.length !== 2) throw new Error("삭제되었거나 존재하지 않는 회원과는 새 채팅을 시작할 수 없습니다.");
      let listing: typeof productsTable.$inferSelect | undefined;
      // Lock a stable parent row before lookup+insert so parallel requests cannot create
      // two open rooms for the same buyer/listing. No schema migration is required.
      if (productId) {
        const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId)).for("update");
        listing = product;
        const ownerId = product && localProductSellerId(product);
        if (!ownerId || product?.status !== "active" ||
            (sellerId !== undefined && (product.category !== "sell" || ownerId !== resolvedSellerId)) ||
            (buyerId !== undefined && (product.category !== "buy" || ownerId !== resolvedBuyerId))) {
          throw new Error("이 글은 이 사이트의 작성자와 연결되어 있지 않아 채팅할 수 없습니다.");
        }
      } else {
        await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, resolvedSellerId)).for("update");
      }
      const conditions = [eq(chatRoomsTable.buyerId, resolvedBuyerId), eq(chatRoomsTable.sellerId, resolvedSellerId)];
      if (productId) conditions.push(eq(chatRoomsTable.productId, productId));
      const existingRooms = await tx.select().from(chatRoomsTable).where(and(...conditions)).orderBy(desc(chatRoomsTable.id));
      const existing = existingRooms.find(room => !["ended", "cancelled", "rejected"].includes(room.status));
      if (existing) {
        let names = tradeCharacterNames(existing, listing);
        const ownField = userId === resolvedBuyerId ? "buyerCharacterName" : "sellerCharacterName";
        if (!names[ownField] && applicantCharacterName) names[ownField] = applicantCharacterName;
        names = tradeCharacterNames({ ...existing, ...names }, listing);
        const [updated] = await tx.update(chatRoomsTable).set({
          ...names,
          buyerDismissedAt: null, sellerDismissedAt: null,
          goodsType: existing.goodsType ?? goodsType ?? null,
        }).where(eq(chatRoomsTable.id, existing.id)).returning();
        return { room: updated, created: false };
      }
      let names = tradeCharacterNames({}, listing);
      if (userId === resolvedBuyerId) names.buyerCharacterName = applicantCharacterName;
      else names.sellerCharacterName = applicantCharacterName;
      names = tradeCharacterNames(names, listing);
      const [room] = await tx.insert(chatRoomsTable).values({
        buyerId: resolvedBuyerId, sellerId: resolvedSellerId, productId: productId ?? null,
        characterName: applicantCharacterName, goodsType: goodsType ?? null,
        ...names,
      }).returning();
      return { room, created: true };
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "채팅방을 열 수 없습니다." });
    return;
  }
  const { room, created } = result;
  if (!created) {
    res.json({ id: room.id, created: false });
    return;
  }

  notifyAdmin("채팅 거래 시작", {
    body: `채팅방 #${room.id} 거래가 시작되었습니다.`,
    link: "/banana777",
  }).catch(() => {});

  res.status(201).json({ id: room.id, created: true });
});

// Legacy paid member trades still use this endpoint; the chat UI intentionally
// has no new-payment action. Keep this path for existing paid-flow compatibility,
// Completion also settles rooms that have not used this optional prepayment path.
// Buyer pays for an active, locally-owned member listing using its current server price.
router.post("/chat/rooms/:roomId/pay", requireAuth, async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId as string, 10);
  const userId = req.session.userId!;

  try {
    const result = await db.transaction(async (tx) => {
      const [room] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).for("update");
      if (!room) throw new Error("채팅방을 찾을 수 없습니다.");
      if (room.buyerId !== userId) throw new Error("구매자만 결제할 수 있습니다.");
      if (room.orderId) throw new Error("이미 결제된 거래입니다.");
      if (!["pending", "active"].includes(room.status)) throw new Error("종료된 채팅방에서는 결제할 수 없습니다.");
      if (!room.productId) throw new Error("결제 가능한 판매글이 연결되지 않았습니다.");

      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, room.productId)).for("update");
      const ownerId = product && localProductSellerId(product);
       if (!product || product.status !== "active" ||
           !ownerId || !(
             (product.category === "sell" && ownerId === room.sellerId) ||
             (product.category === "buy" && ownerId === room.buyerId)
           ) || room.sellerId === room.buyerId) {
         throw new Error("활성 상태의 회원 글과 거래 당사자가 일치하지 않습니다.");
      }
      const amount = Number(product.price);
      if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("판매글 가격이 올바르지 않습니다.");

      const [wallet] = await tx.update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${amount}` })
        .where(and(eq(walletsTable.userId, userId), gte(walletsTable.balance, amount)))
        .returning();
      if (!wallet) throw new Error("잔액이 부족합니다.");

      const [order] = await tx.insert(ordersTable).values({
        buyerId: room.buyerId,
        sellerId: room.sellerId,
        productId: product.id,
        productTitle: product.title,
        amount,
        feeAmount: 0,
        status: "pending",
      }).returning();
      await tx.insert(escrowLedgerTable).values({ orderId: order.id, type: "charge", amount });
      await tx.update(chatRoomsTable).set({ orderId: order.id }).where(and(
        eq(chatRoomsTable.id, roomId),
        eq(chatRoomsTable.buyerId, userId),
        sql`${chatRoomsTable.orderId} IS NULL`,
      ));
      await tx.update(productsTable).set({ status: "sold" }).where(eq(productsTable.id, product.id));
      return { order, balance: Number(wallet.balance) };
    });
    pushToUser(userId, "balance", { balance: result.balance });
    res.status(201).json({
      id: result.order.id,
      buyerId: result.order.buyerId,
      sellerId: result.order.sellerId,
      productId: result.order.productId,
      productTitle: result.order.productTitle,
      amount: Number(result.order.amount),
      feeAmount: Number(result.order.feeAmount),
      netAmount: Number(result.order.amount) - Number(result.order.feeAmount),
      status: result.order.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다.";
    res.status(message === "채팅방을 찾을 수 없습니다." ? 404 : 400).json({ error: message });
  }
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

  if (!["handover", "ended", "cancelled"].includes(status)) {
    res.status(400).json({ error: "이 상태로 변경할 수 없습니다." });
    return;
  }
  let room: typeof chatRoomsTable.$inferSelect;
  let newBalance: number | null = null;
  let buyerBalance: number | null = null;
  let settlement: { amount: number; netAmount: number } | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      const [lockedRoom] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).for("update");
      if (!lockedRoom) throw new Error("채팅방을 찾을 수 없습니다.");
      if (lockedRoom.buyerId !== userId && lockedRoom.sellerId !== userId) throw new Error("접근 권한이 없습니다.");
      if (status === "handover" && userId !== lockedRoom.sellerId) throw new Error("판매자만 인계하기를 할 수 있습니다.");
      if (status === "ended" && userId !== lockedRoom.buyerId) throw new Error("구매자만 거래완료를 할 수 있습니다.");
      if (status === "handover" && !["pending", "active"].includes(lockedRoom.status)) {
        throw new Error("거래 진행 중인 방에서만 인계할 수 있습니다.");
      }
      if (status === "ended" && lockedRoom.status !== "handover") {
        throw new Error("판매자가 인계한 후에만 인수확인할 수 있습니다.");
      }
      if (status === "cancelled" && ["cancelled", "ended", "rejected"].includes(lockedRoom.status)) {
        throw new Error("취소할 수 없는 채팅방 상태입니다.");
      }

      let updatedBalance: number | null = null;
      let debitedBuyerBalance: number | null = null;
      let settledAmounts: { amount: number; netAmount: number } | null = null;
      let completedRoom = lockedRoom;
      if (lockedRoom.orderId) {
        const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, lockedRoom.orderId)).for("update");
        if (!order || order.buyerId !== lockedRoom.buyerId || order.sellerId !== lockedRoom.sellerId ||
            (lockedRoom.productId !== null && order.productId !== lockedRoom.productId)) {
          throw new Error("채팅방과 주문 정보가 일치하지 않습니다.");
        }
        const [charge] = await tx.select({ id: escrowLedgerTable.id }).from(escrowLedgerTable).where(and(
          eq(escrowLedgerTable.orderId, order.id),
          eq(escrowLedgerTable.type, "charge"),
        )).limit(1);

        if (status === "handover") {
          if (!charge || order.status !== "pending") throw new Error("결제가 완료된 대기 주문만 인계할 수 있습니다.");
          await tx.update(ordersTable).set({ status: "shipped" }).where(and(
            eq(ordersTable.id, order.id), eq(ordersTable.status, "pending"),
          ));
        } else if (status === "ended") {
          if (!charge || order.status !== "shipped") throw new Error("결제 및 인계가 완료된 주문만 종료할 수 있습니다.");
          // Existing prepaid orders also settle fee-free from now on.
          // Completed historical orders are never rewritten by this endpoint.
          const netAmount = Number(order.amount);
          if (!Number.isSafeInteger(netAmount) || netAmount < 1) throw new Error("주문 정산 금액이 올바르지 않습니다.");
          const [completed] = await tx.update(ordersTable).set({ status: "completed", feeAmount: 0 }).where(and(
            eq(ordersTable.id, order.id), eq(ordersTable.status, "shipped"),
          )).returning();
          if (!completed) throw new Error("이미 처리된 주문입니다.");
          const [wallet] = await tx.insert(walletsTable).values({
            userId: lockedRoom.sellerId, balance: netAmount,
          }).onConflictDoUpdate({
            target: walletsTable.userId,
            set: { balance: sql`${walletsTable.balance} + ${netAmount}` },
          }).returning();
          updatedBalance = Number(wallet.balance);
          if (!Number.isSafeInteger(updatedBalance) || updatedBalance < 0) throw new Error("판매자 마일리지 잔액이 허용 범위를 초과했습니다.");
          settledAmounts = { amount: Number(order.amount), netAmount };
          await tx.insert(escrowLedgerTable).values({ orderId: order.id, type: "release", amount: netAmount });
        } else if (status === "cancelled" && ["pending", "shipped"].includes(order.status)) {
          if (!charge) throw new Error("결제 기록이 없는 주문은 환불할 수 없습니다.");
          const [cancelled] = await tx.update(ordersTable).set({ status: "cancelled" }).where(and(
            eq(ordersTable.id, order.id), or(eq(ordersTable.status, "pending"), eq(ordersTable.status, "shipped")),
          )).returning();
          if (!cancelled) throw new Error("이미 처리된 주문입니다.");
          const amount = Number(order.amount);
          const [wallet] = await tx.insert(walletsTable).values({
            userId: lockedRoom.buyerId, balance: amount,
          }).onConflictDoUpdate({
            target: walletsTable.userId,
            set: { balance: sql`${walletsTable.balance} + ${amount}` },
          }).returning();
          updatedBalance = Number(wallet.balance);
          await tx.insert(escrowLedgerTable).values({ orderId: order.id, type: "refund", amount });
          if (order.productId) {
            const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, order.productId));
             if (product && localProductSellerId(product) === (product.category === "buy" ? lockedRoom.buyerId : lockedRoom.sellerId)) {
              await tx.update(productsTable).set({ status: "active" }).where(and(
                eq(productsTable.id, product.id), eq(productsTable.status, "sold"),
              ));
            }
          }
        } else if (status === "cancelled" && order.status !== "cancelled") {
          throw new Error("완료된 주문은 취소할 수 없습니다.");
        }
      }
      // Handover does not debit an unpaid room. Buyer receipt settles both wallets,
      // records the completed order and closes the listing in this same transaction.
      if (!lockedRoom.orderId && status === "ended" && !lockedRoom.productId) {
        throw new Error("거래 금액을 확인할 수 있는 게시글이 연결되지 않았습니다.");
      }
      if (!lockedRoom.orderId && lockedRoom.productId && (status === "handover" || status === "ended")) {
        const [product] = await tx.select().from(productsTable)
          .where(eq(productsTable.id, lockedRoom.productId)).for("update");
        const expectedOwner = product?.category === "buy" ? lockedRoom.buyerId : lockedRoom.sellerId;
        if (!product || !["sell", "buy"].includes(product.category ?? "") ||
            localProductSellerId(product) !== expectedOwner || lockedRoom.buyerId === lockedRoom.sellerId) {
          throw new Error("채팅방과 게시글의 작성자가 일치하지 않습니다.");
        }
        if (product.status === "sold") {
          throw new Error("다른 거래에서 이미 완료된 게시글입니다.");
        }
        if (status === "handover" && product.status !== "active") {
          throw new Error("판매중인 게시글에서만 인계할 수 있습니다.");
        }
        if (status === "ended") {
          // Archived listings remain hidden, so their status alone cannot prevent
          // two already-handed-over rooms from settling the same listing.
          const [existingOrder] = await tx.select({ id: ordersTable.id }).from(ordersTable).where(and(
            eq(ordersTable.productId, product.id), ne(ordersTable.status, "cancelled"),
          )).limit(1);
          if (existingOrder) throw new Error("다른 거래에서 이미 결제 또는 정산된 게시글입니다.");
          const amount = Number(product.price);
          if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("게시글 거래 금액이 올바르지 않습니다.");
          const feeAmount = 0;
          const netAmount = amount;
          // Stable wallet lock order also covers trades where the two members swap roles.
          await tx.select({ userId: walletsTable.userId }).from(walletsTable)
            .where(or(eq(walletsTable.userId, lockedRoom.buyerId), eq(walletsTable.userId, lockedRoom.sellerId)))
            .orderBy(walletsTable.userId).for("update");
          const [buyerWallet] = await tx.update(walletsTable)
            .set({ balance: sql`${walletsTable.balance} - ${amount}` })
            .where(and(eq(walletsTable.userId, lockedRoom.buyerId), gte(walletsTable.balance, amount)))
            .returning();
          if (!buyerWallet) throw new Error("구매자의 마일리지가 부족하여 거래를 종료할 수 없습니다.");
          const [sellerWallet] = await tx.insert(walletsTable).values({
            userId: lockedRoom.sellerId, balance: netAmount,
          }).onConflictDoUpdate({
            target: walletsTable.userId,
            set: { balance: sql`${walletsTable.balance} + ${netAmount}` },
          }).returning();
          if (!Number.isSafeInteger(Number(buyerWallet.balance)) || Number(buyerWallet.balance) < 0 ||
              !Number.isSafeInteger(Number(sellerWallet.balance)) || Number(sellerWallet.balance) < 0) {
            throw new Error("마일리지 잔액이 허용 범위를 초과했습니다.");
          }
          const [order] = await tx.insert(ordersTable).values({
            buyerId: lockedRoom.buyerId, sellerId: lockedRoom.sellerId,
            productId: product.id, productTitle: product.title,
            amount, feeAmount, status: "completed",
          }).returning();
          await tx.insert(escrowLedgerTable).values([
            { orderId: order.id, type: "charge", amount },
            { orderId: order.id, type: "release", amount: netAmount },
          ]);
          await tx.update(chatRoomsTable).set({ orderId: order.id }).where(eq(chatRoomsTable.id, roomId));
          completedRoom = { ...lockedRoom, orderId: order.id };
          debitedBuyerBalance = Number(buyerWallet.balance);
          updatedBalance = Number(sellerWallet.balance);
          settledAmounts = { amount, netAmount };
          if (product.status === "active") {
            await tx.update(productsTable).set({ status: "sold" })
              .where(and(eq(productsTable.id, product.id), eq(productsTable.status, "active")));
          }
        }
        // Admin-archived (inactive) listings stay hidden if a room that was
        // already handed over is later acknowledged.
      }

      await tx.update(chatRoomsTable).set({ status }).where(eq(chatRoomsTable.id, roomId));
      return { room: completedRoom, balance: updatedBalance, buyerBalance: debitedBuyerBalance, settlement: settledAmounts };
    });
    room = result.room;
    newBalance = result.balance;
    buyerBalance = result.buyerBalance;
    settlement = result.settlement;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "거래 상태를 변경할 수 없습니다.";
    const code = message === "채팅방을 찾을 수 없습니다." ? 404 :
      ["접근 권한이 없습니다.", "판매자만 인계하기를 할 수 있습니다.", "구매자만 거래완료를 할 수 있습니다."].includes(message) ? 403 : 400;
    res.status(code).json({ error: message });
    return;
  }

  if (newBalance !== null) pushToUser(status === "ended" ? room!.sellerId : room!.buyerId, "balance", { balance: newBalance });
  if (buyerBalance !== null) pushToUser(room!.buyerId, "balance", { balance: buyerBalance });

  // 판매자가 인계하기 → 구매자에게 실시간 알림 (인수확인 버튼 활성화)
  if (status === "handover") {
    pushToUser(room.buyerId, "chat_handover", { roomId });
    await createNotification(room.buyerId, "trade_handover", "아이템 인계 완료", {
      body: "판매자가 아이템을 인계했습니다. 인수확인을 진행해 주세요.",
      link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
    }).catch(() => {});
    notifyAdmin("인계하기 완료", {
      body: `채팅방 #${roomId} — 판매자가 아이템을 인계했습니다.`,
    link: "/banana777",
    }).catch(() => {});
  }

  // 거래 취소
  if (status === "cancelled") {
    const otherId = userId === room.buyerId ? room.sellerId : room.buyerId;
    await createNotification(otherId, "trade_cancelled", "거래가 취소되었습니다", {
      body: "상대방이 거래를 취소했습니다.",
      link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
    }).catch(() => {});
    notifyAdmin("거래 취소", {
      body: `채팅방 #${roomId} 거래가 취소되었습니다.`,
      link: "/banana777",
    }).catch(() => {});
  }

  // Both prepaid and completion-time settlements were committed above.
  if (status === "ended") {
    const { amount, netAmount } = settlement!;
    await createNotification(room!.sellerId, "trade_ended", "거래가 완료되었습니다", {
      body: `마일리지 ${netAmount.toLocaleString("ko-KR")}원이 지급되었습니다.`,
      link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
    }).catch(() => {});
    if (buyerBalance !== null) {
      await createNotification(room!.buyerId, "system", "거래 마일리지 차감", {
        body: `거래 완료로 마일리지 ${amount.toLocaleString("ko-KR")}원이 차감되었습니다.`,
        link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
      }).catch(() => {});
    }
    notifyAdmin("거래 완료", {
      body: `채팅방 #${roomId} 거래 완료 — ${amount.toLocaleString("ko-KR")}원`,
      link: "/banana777",
    }).catch(() => {});
  }

  res.json({ id: roomId, status });
});

// Closing a chat is personal list visibility, never a trade cancellation.
router.post("/chat/rooms/:roomId/dismiss", requireAuth, async (req, res): Promise<void> => {
  const roomId = Number(req.params.roomId);
  if (!Number.isSafeInteger(roomId) || roomId <= 0) {
    res.status(400).json({ error: "올바른 채팅방 번호가 아닙니다." }); return;
  }
  const userId = req.session.userId!;
  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
  if (!room) { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
  if (userId !== room.buyerId && userId !== room.sellerId) {
    res.status(403).json({ error: "접근 권한이 없습니다." }); return;
  }
  await db.update(chatRoomsTable).set(userId === room.buyerId
    ? { buyerDismissedAt: new Date() } : { sellerDismissedAt: new Date() }
  ).where(eq(chatRoomsTable.id, roomId));
  pushToUser(userId, "chat_dismissed", { roomId });
  res.json({ success: true });
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
    .orderBy(desc(chatMessagesTable.id))
    .limit(50);

  const memberFields = { nickname: usersTable.nickname, name: usersTable.name, phone: usersTable.phone, grade: usersTable.grade,
    creditScore: usersTable.creditScore, authStates: usersTable.authStates };
  const [buyer] = await db.select(memberFields).from(usersTable).where(eq(usersTable.id, room.buyerId));
  const [seller] = await db.select(memberFields).from(usersTable).where(eq(usersTable.id, room.sellerId));

   let productTitle: string | null = null;
   let productPrice: number | null = null;
   let gameName: string | null = null;
   let serverName: string | null = null;
   let productCategory: string | null = null;
   let productCreatedAt: Date | null = null;
   let productItemmaniaId: string | null = null;
   let productItemCategory: string | null = null;
   let productDescription: string | null = null;
   let characterListing: { category: string | null; description: string | null; registeredCharacterName: string | null; characterNameInDescription: boolean } | undefined;
  if (room.productId) {
     const [prod] = await db.select({ title: productsTable.title, price: productsTable.price, gameName: productsTable.gameName, serverName: productsTable.serverName, category: productsTable.category, description: productsTable.description, registeredCharacterName: productsTable.registeredCharacterName, characterNameInDescription: productsTable.characterNameInDescription,
       createdAt: productsTable.createdAt, itemmaniaid: productsTable.itemmaniaid, itemCategory: productsTable.itemCategory }).from(productsTable).where(eq(productsTable.id, room.productId));
    productTitle = prod?.title ?? null;
    productPrice = prod?.price ?? null;
     gameName = prod?.gameName ?? null;
     serverName = prod?.serverName ?? null;
     productCategory = prod?.category ?? null;
     productCreatedAt = prod?.createdAt ?? null;
     productItemmaniaId = prod?.itemmaniaid ?? null;
     productItemCategory = prod?.itemCategory ?? null;
     productDescription = prod ? publicListingDescription(prod) : null;
     characterListing = prod;
  }

  // 구매자 실명/전화번호: 판매자 또는 어드민에게만 노출
  const isSeller = userId === room.sellerId || req.session.userRole === "admin";
  const buyerName = isSeller || userId === room.buyerId ? (buyer?.name ?? null) : null;
  const buyerPhone = isSeller || userId === room.buyerId ? (buyer?.phone ?? null) : null;
  const applied = Boolean(room.orderId || room.characterName || room.buyerCharacterName || room.sellerCharacterName);

  const [linkedOrder] = room.orderId
    ? await db.select({
        status: ordersTable.status, amount: ordersTable.amount, productTitle: ordersTable.productTitle,
        createdAt: ordersTable.createdAt,
      }).from(ordersTable).where(eq(ordersTable.id, room.orderId))
    : [];
  res.json({
    room: {
      id: room.id,
      buyerId: room.buyerId,
      sellerId: room.sellerId,
      productId: room.productId,
      status: room.status,
      productTitle: linkedOrder?.productTitle ?? productTitle,
      productPrice: linkedOrder ? Number(linkedOrder.amount) : productPrice,
      productCreatedAt,
      productItemmaniaId,
      productItemCategory,
      productDescription,
       gameName,
       serverName,
       productCategory,
      orderId: room.orderId ?? null,
      orderStatus: linkedOrder?.status ?? null,
       createdAt: room.createdAt,
       orderCreatedAt: linkedOrder?.createdAt ?? null,
       tradeInfo: chatTradeInfo(room, linkedOrder),
      characterName: room.characterName ?? null,
      ...tradeCharacterNames(room, characterListing),
      goodsType: room.goodsType ?? null,
      buyerNickname: buyer?.nickname ?? String(room.buyerId),
      sellerNickname: seller?.nickname ?? String(room.sellerId),
      buyerGrade: buyer?.grade ?? null,
      sellerGrade: seller?.grade ?? null,
      buyerCreditScore: buyer?.creditScore ?? null,
      sellerCreditScore: seller?.creditScore ?? null,
      buyerAuthStates: buyer?.authStates ?? null,
      sellerAuthStates: seller?.authStates ?? null,
      buyerName,
      buyerPhone,
      sellerName: applied || userId === room.sellerId ? seller?.name ?? null : null,
      sellerPhone: applied || userId === room.sellerId ? seller?.phone ?? null : null,
    },
    messages: messages.reverse().map(m => ({
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
  if (!req.file) { res.status(400).json({ error: "이미지를 선택하세요." }); return; }

  const imageUrl = `/chat-images/${req.file.filename}`;
  let room: typeof chatRoomsTable.$inferSelect;
  let message: typeof chatMessagesTable.$inferSelect;
  try {
    ({ room, message } = await db.transaction(async tx => {
      const [locked] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).for("update");
      if (!locked) throw new Error("채팅방을 찾을 수 없습니다.");
      if (locked.buyerId !== userId && locked.sellerId !== userId) throw new Error("접근 권한이 없습니다.");
      if (["ended", "cancelled", "rejected"].includes(locked.status)) throw new Error("종료된 채팅방에는 메시지를 보낼 수 없습니다.");
      if (locked.status === "pending") {
        await tx.update(chatRoomsTable).set({ status: "active" }).where(eq(chatRoomsTable.id, roomId));
      }
      await tx.update(chatRoomsTable).set({ buyerDismissedAt: null, sellerDismissedAt: null })
        .where(eq(chatRoomsTable.id, roomId));
      const [created] = await tx.insert(chatMessagesTable).values({
        roomId, senderId: userId, content: `[img]${imageUrl}`,
      }).returning();
      return { room: locked, message: created };
    }));
  } catch (error) {
    fs.rm(req.file.path, { force: true }, () => {});
    const msg = error instanceof Error ? error.message : "메시지를 보낼 수 없습니다.";
    res.status(msg.includes("찾을 수") ? 404 : msg.includes("접근 권한") ? 403 : 400).json({ error: msg });
    return;
  }

  // 상대방에게 채팅 알림
  const uploadRecipientId = userId === room.buyerId ? room.sellerId : room.buyerId;
  const [uploadSender] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, userId));
  await createNotification(uploadRecipientId, "chat_message", `${uploadSender?.nickname ?? "상대방"}님의 메시지`, {
    body: "📷 사진을 보냈습니다.",
    link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
  }).catch(() => {});

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

  let room: typeof chatRoomsTable.$inferSelect;
  let message: typeof chatMessagesTable.$inferSelect;
  try {
    ({ room, message } = await db.transaction(async tx => {
      const [locked] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).for("update");
      if (!locked) throw new Error("채팅방을 찾을 수 없습니다.");
      if (locked.buyerId !== userId && locked.sellerId !== userId) throw new Error("접근 권한이 없습니다.");
      if (["ended", "cancelled", "rejected"].includes(locked.status)) throw new Error("종료된 채팅방에는 메시지를 보낼 수 없습니다.");
      if (locked.status === "pending") {
        await tx.update(chatRoomsTable).set({ status: "active" }).where(eq(chatRoomsTable.id, roomId));
      }
      await tx.update(chatRoomsTable).set({ buyerDismissedAt: null, sellerDismissedAt: null })
        .where(eq(chatRoomsTable.id, roomId));
      const [created] = await tx.insert(chatMessagesTable).values({
        roomId, senderId: userId, content: content.trim(),
      }).returning();
      return { room: locked, message: created };
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "메시지를 보낼 수 없습니다.";
    res.status(msg.includes("찾을 수") ? 404 : msg.includes("접근 권한") ? 403 : 400).json({ error: msg });
    return;
  }

  // 상대방에게 채팅 알림 전송
  const recipientId = userId === room.buyerId ? room.sellerId : room.buyerId;
  const [sender] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, userId));
  const senderName = sender?.nickname ?? "상대방";
  const preview = content.trim().startsWith("[img]") ? "📷 사진을 보냈습니다." : (content.trim().length > 30 ? content.trim().slice(0, 30) + "…" : content.trim());
  await createNotification(recipientId, "chat_message", `${senderName}님의 메시지`, {
    body: preview,
    link: `/myroom/chat/new_chat.html?roomId=${roomId}`,
  }).catch(() => {});

  res.status(201).json({
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
  });
});

export default router;
