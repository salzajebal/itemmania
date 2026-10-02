import { Router, type IRouter } from "express";
import { eq, or, sql, and, gte } from "drizzle-orm";
import { db, ordersTable, walletsTable, escrowLedgerTable, chatRoomsTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { localProductSellerId } from "./product-ownership";

const router: IRouter = Router();

function formatOrder(order: typeof ordersTable.$inferSelect) {
  const amount = Number(order.amount);
  // Retain historical settled fees; future settlements pay the full amount.
  const feeAmount = order.status === "completed" ? Number(order.feeAmount ?? 0) : 0;
  return {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    productId: order.productId,
    productTitle: order.productTitle,
    amount,
    feeAmount,
    netAmount: amount - feeAmount,
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

// Member listings must be paid from their chat room. Keep the existing external
// listing order path separate; it has no local seller to settle through chat.
router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const productId = Number(req.body?.productId);
  if (!Number.isSafeInteger(productId) || productId < 1) {
    res.status(400).json({ error: "상품 ID가 필요합니다." });
    return;
  }
  try {
    const order = await db.transaction(async tx => {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId)).for("update");
      if (!product) throw new Error("판매글을 찾을 수 없습니다.");
      if (localProductSellerId(product)) {
        throw new Error("회원 판매글은 채팅방에서 결제하기를 눌러주세요.");
      }
      if (product.category !== "sell" || product.status !== "active") {
        throw new Error("활성 상태의 판매글을 찾을 수 없습니다.");
      }
      const amount = Number(product.price);
      if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("판매글 가격이 올바르지 않습니다.");
      const [wallet] = await tx.update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${amount}` })
        .where(and(eq(walletsTable.userId, req.session.userId!), gte(walletsTable.balance, amount)))
        .returning();
      if (!wallet) throw new Error("잔액이 부족합니다.");
      const [created] = await tx.insert(ordersTable).values({
        buyerId: req.session.userId!, sellerId: null, productId: product.id,
        productTitle: product.title, amount, feeAmount: 0, status: "pending",
      }).returning();
      await tx.insert(escrowLedgerTable).values({ orderId: created.id, type: "charge", amount });
      return created;
    });
    res.status(201).json(formatOrder(order));
  } catch (error) {
    const message = error instanceof Error ? error.message : "주문을 만들 수 없습니다.";
    res.status(message.includes("회원 판매글") ? 409 : 400).json({ error: message });
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
  const id = Number(raw);
  const userId = req.session.userId!;
  if (!Number.isSafeInteger(id) || id < 1) { res.status(404).json({ error: "주문을 찾을 수 없습니다." }); return; }
  try {
    const updated = await db.transaction(async tx => {
      const [linked] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.orderId, id)).limit(1);
      if (linked) await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, linked.id)).for("update");
      const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update");
      if (!order) throw new Error("주문을 찾을 수 없습니다.");
      if (order.sellerId !== userId) throw new Error("판매자만 처리할 수 있습니다.");
      if (order.status !== "pending" || (linked && !["active", "pending"].includes(linked.status))) throw new Error("결제된 대기 주문만 인계할 수 있습니다.");
      const [charge] = await tx.select().from(escrowLedgerTable).where(and(eq(escrowLedgerTable.orderId, id), eq(escrowLedgerTable.type, "charge"))).limit(1);
      if (!charge) throw new Error("결제 기록이 없는 주문은 인계할 수 없습니다.");
      const [changed] = await tx.update(ordersTable).set({ status: "shipped" })
        .where(and(eq(ordersTable.id, id), eq(ordersTable.status, "pending"))).returning();
      if (!changed) throw new Error("이미 처리된 주문입니다.");
      if (linked) await tx.update(chatRoomsTable).set({ status: "handover" }).where(eq(chatRoomsTable.id, linked.id));
      return changed;
    });
    res.json(formatOrder(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "인계 처리에 실패했습니다.";
    res.status(message.includes("찾을 수") ? 404 : message.includes("판매자만") ? 403 : 400).json({ error: message });
  }
});

// 구매자 인수확인 (판매자 대금 지급)
router.patch("/orders/:id/confirm", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  const userId = req.session.userId!;
  if (!Number.isSafeInteger(id) || id < 1) { res.status(404).json({ error: "주문을 찾을 수 없습니다." }); return; }
  try {
    const updated = await db.transaction(async tx => {
      const [linked] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.orderId, id)).limit(1);
      if (linked) await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, linked.id)).for("update");
      const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update");
      if (!order) throw new Error("주문을 찾을 수 없습니다.");
      if (order.buyerId !== userId) throw new Error("구매자만 인수확인할 수 있습니다.");
      if (order.status !== "shipped" || (linked && linked.status !== "handover")) throw new Error("인계 완료 후에만 인수확인할 수 있습니다.");
      if (!order.sellerId) throw new Error("판매자가 지정되지 않은 주문입니다.");
      const [charge] = await tx.select().from(escrowLedgerTable).where(and(eq(escrowLedgerTable.orderId, id), eq(escrowLedgerTable.type, "charge"))).limit(1);
      if (!charge) throw new Error("결제 기록이 없는 주문입니다.");
      const netToSeller = Number(order.amount);
      if (!Number.isSafeInteger(netToSeller) || netToSeller < 1) throw new Error("주문 정산 금액이 올바르지 않습니다.");
      const [changed] = await tx.update(ordersTable).set({ status: "completed", feeAmount: 0 })
        .where(and(eq(ordersTable.id, id), eq(ordersTable.status, "shipped"))).returning();
      if (!changed) throw new Error("이미 처리된 주문입니다.");
      const [sellerWallet] = await tx.insert(walletsTable).values({ userId: order.sellerId, balance: netToSeller })
        .onConflictDoUpdate({ target: walletsTable.userId, set: { balance: sql`${walletsTable.balance} + ${netToSeller}` } }).returning();
      if (!Number.isSafeInteger(Number(sellerWallet.balance)) || Number(sellerWallet.balance) < 0) {
        throw new Error("판매자 마일리지 잔액이 허용 범위를 초과했습니다.");
      }
      await tx.insert(escrowLedgerTable).values({ orderId: id, type: "release", amount: netToSeller });
      if (linked) await tx.update(chatRoomsTable).set({ status: "ended" }).where(eq(chatRoomsTable.id, linked.id));
      return changed;
    });
    res.json(formatOrder(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "인수확인에 실패했습니다.";
    res.status(message.includes("찾을 수") ? 404 : message.includes("구매자만") ? 403 : 400).json({ error: message });
  }
});

// 주문 취소 + 환불
router.patch("/orders/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  const userId = req.session.userId!;
  const { reason } = req.body ?? {};
  if (!Number.isSafeInteger(id) || id < 1) { res.status(404).json({ error: "주문을 찾을 수 없습니다." }); return; }
  try {
    const updated = await db.transaction(async tx => {
      const [linked] = await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.orderId, id)).limit(1);
      if (linked) await tx.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, linked.id)).for("update");
      const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update");
      if (!order) throw new Error("주문을 찾을 수 없습니다.");
      if (order.buyerId !== userId && order.sellerId !== userId && req.session.userRole !== "admin") throw new Error("접근 권한이 없습니다.");
      if (!["pending", "shipped"].includes(order.status)) throw new Error("취소할 수 없는 상태입니다.");
      const [charge] = await tx.select().from(escrowLedgerTable).where(and(eq(escrowLedgerTable.orderId, id), eq(escrowLedgerTable.type, "charge"))).limit(1);
      if (!charge) throw new Error("결제 기록이 없는 주문은 환불할 수 없습니다.");
      const [changed] = await tx.update(ordersTable).set({ status: "cancelled", cancelReason: typeof reason === "string" ? reason.slice(0, 500) : null })
        .where(and(eq(ordersTable.id, id), or(eq(ordersTable.status, "pending"), eq(ordersTable.status, "shipped")))).returning();
      if (!changed) throw new Error("이미 처리된 주문입니다.");
      const amount = Number(order.amount);
      await tx.insert(walletsTable).values({ userId: order.buyerId, balance: amount })
        .onConflictDoUpdate({ target: walletsTable.userId, set: { balance: sql`${walletsTable.balance} + ${amount}` } });
      await tx.insert(escrowLedgerTable).values({ orderId: id, type: "refund", amount });
      if (linked) await tx.update(chatRoomsTable).set({ status: "cancelled" }).where(eq(chatRoomsTable.id, linked.id));
      if (order.productId) {
        const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, order.productId));
        if (product && localProductSellerId(product) === (product.category === "buy" ? order.buyerId : order.sellerId)) {
          await tx.update(productsTable).set({ status: "active" }).where(and(eq(productsTable.id, order.productId), eq(productsTable.status, "sold")));
        }
      }
      return changed;
    });
    res.json(formatOrder(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "취소 처리에 실패했습니다.";
    res.status(message.includes("찾을 수") ? 404 : message.includes("접근 권한") ? 403 : 400).json({ error: message });
  }
});

export default router;
