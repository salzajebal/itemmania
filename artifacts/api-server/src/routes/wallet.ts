import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, walletsTable, withdrawalsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { pushToUser } from "../lib/sse";
import { notifyAdmin } from "./notifications";

const router: IRouter = Router();

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
  pushToUser(req.session.userId!, "balance", { balance: newBalance });

  const [chargeUser] = await db.select({ nickname: usersTable.nickname, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.session.userId!));
  notifyAdmin("입금 충전", {
    body: `${chargeUser?.nickname ?? req.session.userId} — ${net.toLocaleString()}원 (${method})`,
    link: "/banana777",
  }).catch(() => {});

  res.json({ id: updated.id, userId: updated.userId, balance: newBalance, updatedAt: updated.updatedAt });
});

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const { amount, method = "bank", bankName, accountNumber, accountHolder, phoneNumber } = req.body;
  const amountNum = Number(amount);

  if (!amountNum || amountNum < 1000) {
    res.status(400).json({ error: "최소 출금금액은 1,000원입니다." });
    return;
  }

  if (method === "bank") {
    if (!bankName || !accountNumber || !accountHolder) {
      res.status(400).json({ error: "은행명, 계좌번호, 예금주는 필수입니다." });
      return;
    }
  } else if (method === "phone") {
    if (!phoneNumber) {
      res.status(400).json({ error: "휴대폰번호는 필수입니다." });
      return;
    }
    const phoneClean = String(phoneNumber).replace(/\D/g, "");
    if (phoneClean.length < 10 || phoneClean.length > 11) {
      res.status(400).json({ error: "올바른 휴대폰번호를 입력해주세요." });
      return;
    }
  } else {
    res.status(400).json({ error: "출금 방법이 올바르지 않습니다." });
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

    const [withdrawal] = await tx.insert(withdrawalsTable).values(
      method === "bank"
        ? { userId: req.session.userId!, amount: amountNum, method: "bank" as const, bankName, accountNumber, accountHolder, status: "pending" as const }
        : { userId: req.session.userId!, amount: amountNum, method: "phone" as const, phoneNumber: String(phoneNumber).replace(/\D/g, ""), status: "pending" as const }
    ).returning();
    return { withdrawal, newBalance: Number(updated.balance) };
  });

  pushToUser(req.session.userId!, "balance", { balance: result.newBalance });

  const [withdrawUser] = await db.select({ nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.id, req.session.userId!));
  const withdrawDetail = method === "bank"
    ? `${bankName} ${accountNumber} (${accountHolder})`
    : `휴대폰 ${phoneNumber}`;
  notifyAdmin("출금 신청", {
    body: `${withdrawUser?.nickname ?? req.session.userId} — ${amountNum.toLocaleString()}원 / ${withdrawDetail}`,
    link: "/banana777",
  }).catch(() => {});

  res.status(201).json({
    id: result.withdrawal.id,
    userId: result.withdrawal.userId,
    amount: Number(result.withdrawal.amount),
    method: result.withdrawal.method,
    bankName: result.withdrawal.bankName,
    accountNumber: result.withdrawal.accountNumber,
    accountHolder: result.withdrawal.accountHolder,
    phoneNumber: result.withdrawal.phoneNumber,
    status: result.withdrawal.status,
    adminNote: result.withdrawal.adminNote,
    processedAt: result.withdrawal.processedAt,
    createdAt: result.withdrawal.createdAt,
  });
});

router.get("/wallet/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const method = req.query.method as string | undefined;

  let query = db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, req.session.userId!))
    .$dynamic();

  if (method === "bank" || method === "phone") {
    query = query.where(
      and(
        eq(withdrawalsTable.userId, req.session.userId!),
        eq(withdrawalsTable.method, method)
      )
    );
  }

  const withdrawals = await query.orderBy(desc(withdrawalsTable.createdAt));

  res.json(
    withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      method: w.method,
      bankName: w.bankName,
      accountNumber: w.accountNumber,
      accountHolder: w.accountHolder,
      phoneNumber: w.phoneNumber,
      status: w.status,
      adminNote: w.adminNote,
      processedAt: w.processedAt,
      createdAt: w.createdAt,
    }))
  );
});

router.delete("/wallet/withdrawals/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "잘못된 출금 ID입니다." });
    return;
  }

  const [withdrawal] = await db
    .select()
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.id, id), eq(withdrawalsTable.userId, req.session.userId!)));

  if (!withdrawal) {
    res.status(404).json({ error: "출금 내역을 찾을 수 없습니다." });
    return;
  }

  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "처리 중이거나 완료된 출금은 취소할 수 없습니다." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(withdrawalsTable)
      .set({ status: "rejected", adminNote: "사용자가 취소함" })
      .where(eq(withdrawalsTable.id, id));

    await tx
      .update(walletsTable)
      .set({ balance: sql`${walletsTable.balance} + ${Number(withdrawal.amount)}` })
      .where(eq(walletsTable.userId, req.session.userId!));
  });

  const [updatedWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!));
  if (updatedWallet) {
    pushToUser(req.session.userId!, "balance", { balance: Number(updatedWallet.balance) });
  }

  res.json({ ok: true, message: "출금이 취소되었습니다." });
});

export default router;
