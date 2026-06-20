import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, walletsTable, withdrawalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!));
  if (!wallet) {
    // 지갑이 없으면 자동 생성
    const [created] = await db.insert(walletsTable).values({ userId: req.session.userId!, balance: 0 }).returning();
    res.json({ id: created.id, userId: created.userId, balance: Number(created.balance), updatedAt: created.updatedAt });
    return;
  }
  res.json({ id: wallet.id, userId: wallet.userId, balance: Number(wallet.balance), updatedAt: wallet.updatedAt });
});

router.post("/wallet/charge", requireAuth, async (req, res): Promise<void> => {
  const amount = Number(req.body.amount);
  if (!amount || amount < 1000) {
    res.status(400).json({ error: "최소 충전금액은 1,000원입니다." });
    return;
  }

  // 지갑이 없으면 생성
  let [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!));
  if (!wallet) {
    [wallet] = await db.insert(walletsTable).values({ userId: req.session.userId!, balance: 0 }).returning();
  }

  const [updated] = await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} + ${amount}` })
    .where(eq(walletsTable.userId, req.session.userId!))
    .returning();

  res.json({ id: updated.id, userId: updated.userId, balance: Number(updated.balance), updatedAt: updated.updatedAt });
});

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const { amount, bankName, accountNumber, accountHolder } = req.body;
  const amountNum = Number(amount);

  if (!amountNum || amountNum < 1000) {
    res.status(400).json({ error: "최소 출금금액은 1,000원입니다." });
    return;
  }
  if (!bankName || !accountNumber || !accountHolder) {
    res.status(400).json({ error: "은행명, 계좌번호, 예금주는 필수입니다." });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!));
  if (!wallet || Number(wallet.balance) < amountNum) {
    res.status(400).json({ error: "잔액이 부족합니다." });
    return;
  }

  // 원자적으로 잔액 차감 + 출금 신청 생성
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(walletsTable)
      .set({ balance: sql`${walletsTable.balance} - ${amountNum}` })
      .where(eq(walletsTable.userId, req.session.userId!))
      .returning();

    if (Number(updated.balance) < 0) {
      throw new Error("잔액 부족");
    }

    const [withdrawal] = await tx.insert(withdrawalsTable).values({
      userId: req.session.userId!,
      amount: amountNum,
      bankName,
      accountNumber,
      accountHolder,
      status: "pending",
    }).returning();

    return withdrawal;
  });

  res.status(201).json({
    id: result.id,
    userId: result.userId,
    amount: Number(result.amount),
    bankName: result.bankName,
    accountNumber: result.accountNumber,
    accountHolder: result.accountHolder,
    status: result.status,
    adminNote: result.adminNote,
    processedAt: result.processedAt,
    createdAt: result.createdAt,
  });
});

export default router;
