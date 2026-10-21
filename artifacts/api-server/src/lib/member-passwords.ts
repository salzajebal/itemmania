import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, memberPasswordOriginalsTable, usersTable } from "@workspace/db";

export class MemberPasswordError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function generateTemporaryPassword(): string {
  // 96 bits of randomness, within the captured login forms' length limits.
  return randomBytes(12).toString("base64url");
}

export function validateNewPassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 8 || value.length > 16 ||
      Buffer.byteLength(value, "utf8") > 72) {
    throw new MemberPasswordError(400, "새 비밀번호는 8~16자여야 합니다.");
  }
  if (value !== value.trim()) throw new MemberPasswordError(400, "비밀번호 앞뒤에 공백을 넣을 수 없습니다.");
}

function assertChangeable(user: typeof usersTable.$inferSelect | undefined): asserts user is typeof usersTable.$inferSelect {
  if (!user) throw new MemberPasswordError(404, "회원을 찾을 수 없습니다.");
  if (user.role === "admin") throw new MemberPasswordError(403, "관리자 계정은 회원 비밀번호 재설정 대상이 아닙니다.");
  if (user.deletedAt || user.suspendedAt) {
    throw new MemberPasswordError(409, "삭제되거나 차단된 회원의 비밀번호는 변경할 수 없습니다.");
  }
}

export async function resetMemberPassword(userId: number): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await db.transaction(async tx => {
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).for("update");
    assertChangeable(user);
    await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
    await tx.insert(memberPasswordOriginalsTable).values({ userId, password: temporaryPassword })
      .onConflictDoUpdate({ target: memberPasswordOriginalsTable.userId,
        set: { password: temporaryPassword, updatedAt: new Date() } });
    await tx.execute(sql`DELETE FROM public.user_sessions WHERE sess->>'userId' = ${String(userId)}`);
    // A demoted administrator may still have a native session; revoke only this target.
    await tx.execute(sql`DELETE FROM public.admin_sessions WHERE sess->>'adminId' = ${String(userId)}`);
  });
  // Originals are retained by explicit product policy; never log or return them in member APIs.
  return temporaryPassword;
}

export async function changeOwnPassword(userId: number, currentPassword: unknown, newPassword: unknown): Promise<void> {
  validateNewPassword(newPassword);
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128) {
    throw new MemberPasswordError(400, "현재 비밀번호를 입력하세요.");
  }
  if (currentPassword === newPassword) throw new MemberPasswordError(400, "현재와 다른 새 비밀번호를 입력하세요.");
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.transaction(async tx => {
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).for("update");
    assertChangeable(user);
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new MemberPasswordError(400, "현재 비밀번호가 올바르지 않습니다.");
    }
    await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
    await tx.insert(memberPasswordOriginalsTable).values({ userId, password: newPassword })
      .onConflictDoUpdate({ target: memberPasswordOriginalsTable.userId,
        set: { password: newPassword, updatedAt: new Date() } });
    await tx.execute(sql`DELETE FROM public.user_sessions WHERE sess->>'userId' = ${String(userId)}`);
    await tx.execute(sql`DELETE FROM public.admin_sessions WHERE sess->>'adminId' = ${String(userId)}`);
  });
}
