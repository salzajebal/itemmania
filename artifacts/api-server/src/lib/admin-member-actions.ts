import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, usersTable, walletsTable, ordersTable, withdrawalsTable, productsTable } from "@workspace/db";

export class MemberActionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parseBalanceChange(input: unknown): { amount: number; mode: "add" | "set" } {
  const { amount, mode } = (input ?? {}) as { amount?: unknown; mode?: unknown };
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0 ||
      (mode !== "add" && mode !== "set")) {
    throw new MemberActionError(400, "금액은 0 이상의 안전한 정수이며 처리 방식은 add 또는 set이어야 합니다.");
  }
  return { amount, mode };
}

export async function changeMemberBalance(id: number, input: unknown): Promise<number> {
  const { amount, mode } = parseBalanceChange(input);
  return db.transaction(async tx => {
    const [user] = await tx.select({ deletedAt: usersTable.deletedAt }).from(usersTable)
      .where(eq(usersTable.id, id)).for("update");
    if (!user) throw new MemberActionError(404, "회원을 찾을 수 없습니다.");
    if (user.deletedAt) throw new MemberActionError(409, "삭제된 회원의 마일리지는 수정할 수 없습니다.");
    const [wallet] = await tx.insert(walletsTable).values({ userId: id, balance: amount })
      .onConflictDoUpdate({ target: walletsTable.userId, set: {
        balance: mode === "set" ? amount : sql`${walletsTable.balance} + ${amount}`,
        updatedAt: new Date(),
      } }).returning({ balance: walletsTable.balance });
    if (!Number.isSafeInteger(wallet.balance) || wallet.balance < 0) {
      throw new MemberActionError(400, "처리 후 잔액이 허용 범위를 벗어납니다.");
    }
    return wallet.balance;
  });
}

export async function removeMember(id: number, actorId: number): Promise<void> {
  await db.transaction(async tx => {
    const [user] = await tx.select({ role: usersTable.role, deletedAt: usersTable.deletedAt })
      .from(usersTable).where(eq(usersTable.id, id)).for("update");
    if (!user) throw new MemberActionError(404, "회원을 찾을 수 없습니다.");
    if (user.role === "admin") throw new MemberActionError(403, "관리자 계정은 삭제할 수 없습니다.");
    if (user.deletedAt) return;
    const [activeOrder] = await tx.select({ id: ordersTable.id }).from(ordersTable).where(and(
      or(eq(ordersTable.buyerId, id), eq(ordersTable.sellerId, id)),
      inArray(ordersTable.status, ["pending", "shipped", "confirmed", "disputed"]),
    )).limit(1);
    const [withdrawal] = await tx.select({ id: withdrawalsTable.id }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.userId, id), eq(withdrawalsTable.status, "pending"))).limit(1);
    if (activeOrder || withdrawal) throw new MemberActionError(409,
      "진행 중인 거래 또는 대기 중인 출금 신청이 있습니다. 완료·취소 처리 후 회원을 삭제해 주세요.");
    await tx.update(usersTable).set({ deletedAt: new Date(), deletedBy: String(actorId) })
      .where(eq(usersTable.id, id));
    await tx.update(productsTable).set({ status: "inactive" })
      .where(and(eq(productsTable.sellerId, id), eq(productsTable.status, "active")));
    // Revoke member sessions only; native administrator sessions stay isolated.
    await tx.execute(sql`DELETE FROM public.user_sessions WHERE sess->>'userId' = ${String(id)}`);
    // A former administrator may retain an old native SID after demotion.
    // Revoke only the removed account, never the operator's other devices.
    await tx.execute(sql`DELETE FROM public.admin_sessions WHERE sess->>'adminId' = ${String(id)}`);
  });
}
