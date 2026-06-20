import { Router, type IRouter } from "express";
import { eq, or, sql } from "drizzle-orm";
import { db, ordersTable, walletsTable, escrowLedgerTable, chatRoomsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatOrder(order: typeof ordersTable.$inferSelect) {
  return {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    productId: order.productId,
    productTitle: order.productTitle,
    amount: Number(order.amount),
    status: order.status,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// 내 주문 목록
router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const { role } = req.query;
  const userId = req.session.userId!;

  let orders;
  if (role === "seller") {
    orders = await db.select().from(ordersTable).where(eq(ordersTable.sellerId, userId));
  } else if (role === "buyer") {
    orders = await db.select().from(ordersTable).where(eq(ordersTable.buyerId, userId));
  } else {
    orders = await db.select().from(ordersTable).where(
      or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId))
    );
  }

  res.json(orders.map(formatOrder));
});

// 주문 생성 (에스크로)
router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const { productId, productTitle, amount, sellerId } = req.body;
  const buyerId = req.session.userId!;
  const amountNum = Number(amount);

  if (!productTitle || !amountNum || amountNum < 1) {
    res.status(400).json({ error: "상품명과 금액을 입력하세요." });
    return;
  }

  // 원자적 트랜잭션: 잔액 확인 + 차감 + 주문 생성 + 에스크로 기록
  try {
    const order = await db.transaction(async (tx) => {
      // 잔액 확인 및 차감 (balance >= amount 조건)
      const [wallet] = await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${amountNum}` })
        .where(eq(walletsTable.userId, buyerId))
        .returning();

      if (!wallet || Number(wallet.balance) < 0) {
        throw new Error("잔액이 부족합니다.");
      }

      const [newOrder] = await tx.insert(ordersTable).values({
        buyerId,
        sellerId: sellerId ?? null,
        productId: productId ?? null,
        productTitle,
        amount: amountNum,
        status: "pending",
      }).returning();

      // 에스크로 원장 기록
      await tx.insert(escrowLedgerTable).values({
        orderId: newOrder.id,
        type: "charge",
        amount: amountNum,
      });

      // 채팅방 자동 생성 (sellerId가 있을 때)
      if (sellerId) {
        await tx.insert(chatRoomsTable).values({
          orderId: newOrder.id,
          buyerId,
          sellerId,
        });
      }

      return newOrder;
    });

    res.status(201).json(formatOrder(order));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "주문 처리 중 오류가 발생했습니다.";
    res.status(400).json({ error: message });
  }
});

// 주문 상세
router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const userId = req.session.userId!;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "주문을 찾을 수 없습니다." });
    return;
  }

  if (order.buyerId !== userId && order.sellerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "접근 권한이 없습니다." });
    return;
  }

  res.json(formatOrder(order));
});

// 판매자 배송 완료
router.patch("/orders/:id/shipped", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const userId = req.session.userId!;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "주문을 찾을 수 없습니다." });
    return;
  }
  if (order.sellerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "판매자만 처리할 수 있습니다." });
    return;
  }
  if (order.status !== "pending") {
    res.status(400).json({ error: "pending 상태에서만 배송 처리할 수 있습니다." });
    return;
  }

  const [updated] = await db
    .update(ordersTable)
    .set({ status: "shipped" })
    .where(eq(ordersTable.id, id))
    .returning();

  res.json(formatOrder(updated));
});

// 구매자 인수확인 (판매자 대금 지급)
router.patch("/orders/:id/confirm", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const userId = req.session.userId!;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "주문을 찾을 수 없습니다." });
    return;
  }
  if (order.buyerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "구매자만 인수확인할 수 있습니다." });
    return;
  }
  if (!["pending", "shipped"].includes(order.status)) {
    res.status(400).json({ error: "인수확인을 할 수 없는 상태입니다." });
    return;
  }
  if (!order.sellerId) {
    res.status(400).json({ error: "판매자가 지정되지 않은 주문입니다." });
    return;
  }

  // 원자적 트랜잭션: 주문 완료 + 판매자 지갑 지급 + 에스크로 기록
  const updated = await db.transaction(async (tx) => {
    const [o] = await tx
      .update(ordersTable)
      .set({ status: "completed" })
      .where(eq(ordersTable.id, id))
      .returning();

    // 판매자 지갑 지급
    await tx
      .update(walletsTable)
      .set({ balance: sql`${walletsTable.balance} + ${Number(order.amount)}` })
      .where(eq(walletsTable.userId, order.sellerId!));

    await tx.insert(escrowLedgerTable).values({
      orderId: id,
      type: "release",
      amount: Number(order.amount),
    });

    return o;
  });

  res.json(formatOrder(updated));
});

// 주문 취소 + 환불
router.patch("/orders/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const userId = req.session.userId!;
  const { reason } = req.body ?? {};

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "주문을 찾을 수 없습니다." });
    return;
  }
  if (order.buyerId !== userId && order.sellerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "접근 권한이 없습니다." });
    return;
  }
  if (!["pending", "shipped"].includes(order.status)) {
    res.status(400).json({ error: "취소할 수 없는 상태입니다." });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [o] = await tx
      .update(ordersTable)
      .set({ status: "cancelled", cancelReason: reason ?? null })
      .where(eq(ordersTable.id, id))
      .returning();

    // 구매자 환불
    await tx
      .update(walletsTable)
      .set({ balance: sql`${walletsTable.balance} + ${Number(order.amount)}` })
      .where(eq(walletsTable.userId, order.buyerId));

    await tx.insert(escrowLedgerTable).values({
      orderId: id,
      type: "refund",
      amount: Number(order.amount),
    });

    return o;
  });

  res.json(formatOrder(updated));
});

export default router;
