import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, walletsTable, withdrawalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { pushToUser } from "../lib/sse";

const router: IRouter = Router();

// 수단별 수수료 (서버 측 계산)
const FEE_RATES: Record<string, { rate: number; flat: number; min: number }> = {
  kakaopay:    { rate: 0.055, flat: 0,    min: 0 },
  naverpay:    { rate: 0.055, flat: 0,    min: 0 },
  creditcard:  { rate: 0.055, flat: 0,    min: 0 },
  "phone-ars": { rate: 0.195, flat: 0,    min: 0 },
  onlyculture: { rate: 0.12,  flat: 0,    min: 0 },
  gift24:      { rate: 0,     flat: 0,    min: 0 },
  mileage:     { rate: 0.06,  flat: 0,    min: 0 },
  mybank:      { rate: 0.02,  flat: 0,    min: 500 },
  account:     { rate: 0,     flat: 1000, min: 0 },
};

function calcNet(gross: number, method: string): number {
  const f = FEE_RATES[method] ?? { rate: 0, flat: 0, min: 0 };
  let net = Math.floor(gross * (1 - f.rate)) - f.flat;
  if (f.min > 0 && gross - Math.floor(gross * f.rate) < f.min) net = gross - f.min;
  return Math.max(0, net);
}

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!));
  if (!wallet) {
    const [created] = await db.insert(walletsTable).values({ userId: req.session.userId!, balance: 0 }).returning();
    res.json({ id: created.id, userId: created.userId, balance: Number(created.balance), updatedAt: created.updatedAt });
    return;
  }
  res.json({ id: wallet.id, userId: wallet.userId, balance: Number(wallet.balance), updatedAt: wallet.updatedAt });
});

router.post("/wallet/charge", requireAuth, async (req, res): Promise<void> => {
  const gross = Number(req.body.amount);
  const method = String(req.body.method || "");
  if (!gross || gross < 1000) {
    res.status(400).json({ error: "최소 충전금액은 1,000원입니다." });
    return;
  }

  const net = calcNet(gross, method);
  if (net <= 0) {
    res.status(400).json({ error: "수수료 적용 후 충전 금액이 0원입니다." });
    return;
  }

  let [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!));
  if (!wallet) {
    [wallet] = await db.insert(walletsTable).values({ userId: req.session.userId!, balance: 0 }).returning();
  }

  const [updated] = await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} + ${net}` })
    .where(eq(walletsTable.userId, req.session.userId!))
    .returning();

  const newBalance = Number(updated.balance);

  // SSE로 마이룸/다른 탭에도 즉시 반영
  pushToUser(req.session.userId!, "balance", { balance: newBalance });

  res.json({ id: updated.id, userId: updated.userId, balance: newBalance, updatedAt: updated.updatedAt });
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
