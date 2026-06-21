import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, usersTable, ordersTable, withdrawalsTable, walletsTable, productsTable } from "@workspace/db";
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

// ── 상품 관리 ──────────────────────────────────────────────────────

// 전체 상품 목록
router.get("/admin/products", requireAdmin, async (req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(products.map(p => ({
    id: p.id,
    itemmaniaid: p.itemmaniaid,
    title: p.title,
    price: Number(p.price),
    category: p.category,
    gameName: p.gameName,
    sellerName: p.sellerName,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
  })));
});

// 상품 등록 (어드민)
router.post("/admin/products", requireAdmin, async (req, res): Promise<void> => {
  const { title, price, gameName, category, description, sellerName } = req.body as Record<string, string>;
  if (!title || !price) {
    res.status(400).json({ error: "title과 price는 필수입니다." });
    return;
  }
  const priceNum = parseInt(String(price), 10);
  if (isNaN(priceNum) || priceNum <= 0) {
    res.status(400).json({ error: "price는 양수여야 합니다." });
    return;
  }
  const itemmaniaid = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const [inserted] = await db.insert(productsTable).values({
    itemmaniaid,
    title: String(title).trim(),
    price: priceNum,
    gameName: gameName ? String(gameName).trim() : null,
    category: category ? String(category).trim() : "sell",
    sellerName: sellerName ? String(sellerName).trim() : null,
    description: description ? String(description).trim() : null,
    status: "active",
  }).returning();
  res.status(201).json({ id: inserted.id, itemmaniaid: inserted.itemmaniaid, title: inserted.title });
});

// 상품 상태 변경 / 수정
router.patch("/admin/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { status, title, price, gameName, category, description, sellerName } = req.body as Record<string, string>;

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }

  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (status && ["active","sold","inactive"].includes(status)) updates.status = status as "active"|"sold"|"inactive";
  if (title) updates.title = String(title).trim();
  if (price) { const n = parseInt(String(price), 10); if (!isNaN(n) && n > 0) updates.price = n; }
  if (gameName !== undefined) updates.gameName = gameName ? String(gameName).trim() : null;
  if (category) updates.category = String(category).trim();
  if (description !== undefined) updates.description = description ? String(description).trim() : null;
  if (sellerName !== undefined) updates.sellerName = sellerName ? String(sellerName).trim() : null;

  const [updated] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  res.json({ id: updated.id, status: updated.status, title: updated.title });
});

// 상품 삭제
router.delete("/admin/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

export default router;
