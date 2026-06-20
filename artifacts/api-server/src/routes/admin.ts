import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, ordersTable, withdrawalsTable, walletsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// 전체 회원 목록
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      nickname: usersTable.nickname,
      phone: usersTable.phone,
      role: usersTable.role,
      balance: walletsTable.balance,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(walletsTable, eq(usersTable.id, walletsTable.userId))
    .limit(limit)
    .offset(offset);

  res.json(users.map(u => ({
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    phone: u.phone,
    role: u.role,
    balance: u.balance !== null ? Number(u.balance) : null,
    createdAt: u.createdAt,
  })));
});

// 전체 주문 목록
router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 50;
  const offset = (page - 1) * limit;
  const { status } = req.query;

  let query = db.select().from(ordersTable).$dynamic();
  if (status && typeof status === "string") {
    query = query.where(eq(ordersTable.status, status as typeof ordersTable.$inferSelect["status"]));
  }
  const orders = await query.limit(limit).offset(offset);

  res.json(orders.map(o => ({
    id: o.id,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    productId: o.productId,
    productTitle: o.productTitle,
    amount: Number(o.amount),
    status: o.status,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })));
});

// 출금 신청 목록
router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const { status } = req.query;
  let query = db.select().from(withdrawalsTable).$dynamic();
  if (status && typeof status === "string") {
    query = query.where(eq(withdrawalsTable.status, status as typeof withdrawalsTable.$inferSelect["status"]));
  }
  const withdrawals = await query;
  res.json(withdrawals.map(w => ({
    id: w.id,
    userId: w.userId,
    amount: Number(w.amount),
    bankName: w.bankName,
    accountNumber: w.accountNumber,
    accountHolder: w.accountHolder,
    status: w.status,
    adminNote: w.adminNote,
    processedAt: w.processedAt,
    createdAt: w.createdAt,
  })));
});

// 출금 처리 (승인/거절)
router.patch("/admin/withdrawals/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, adminNote } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status는 approved 또는 rejected여야 합니다." });
    return;
  }

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!withdrawal) {
    res.status(404).json({ error: "출금 신청을 찾을 수 없습니다." });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "이미 처리된 출금 신청입니다." });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [w] = await tx
      .update(withdrawalsTable)
      .set({ status, adminNote: adminNote ?? null, processedAt: new Date() })
      .where(eq(withdrawalsTable.id, id))
      .returning();

    // 거절 시 잔액 환불
    if (status === "rejected") {
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${Number(withdrawal.amount)}` })
        .where(eq(walletsTable.userId, withdrawal.userId));
    }

    return w;
  });

  res.json({
    id: updated.id,
    userId: updated.userId,
    amount: Number(updated.amount),
    bankName: updated.bankName,
    accountNumber: updated.accountNumber,
    accountHolder: updated.accountHolder,
    status: updated.status,
    adminNote: updated.adminNote,
    processedAt: updated.processedAt,
    createdAt: updated.createdAt,
  });
});

export default router;
