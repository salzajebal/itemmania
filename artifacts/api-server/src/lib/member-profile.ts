import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, usersTable, memberProfilesTable } from "@workspace/db";
import { UpdateMemberProfileBody } from "@workspace/api-zod";
import { memberPhoneVariants } from "./member-login-phone";

export class ProfileError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function normalize(body: unknown) {
  const parsed = UpdateMemberProfileBody.strict().safeParse(body);
  if (!parsed.success) throw new ProfileError(400, "입력 항목과 글자 수를 확인해 주세요.");
  const value = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v?.trim() || null])) as typeof parsed.data;
  for (const key of ["name", "bankName", "bankAccountHolder"] as const) {
    if (value[key] && /[<>\u0000-\u001f\u007f]/.test(value[key]!)) {
      throw new ProfileError(400, "이름과 은행명에 사용할 수 없는 문자가 있습니다.");
    }
  }
  if (value.phone) {
    const variants = memberPhoneVariants(value.phone);
    if (!variants || !/^01(?:0\d{8}|[16789]\d{7,8})$/.test(variants[0])) {
      throw new ProfileError(400, "올바른 휴대폰 번호를 입력해 주세요.");
    }
    value.phone = variants[0];
  }
  const bankFields = [value.bankName, value.bankAccountNumber, value.bankAccountHolder];
  if (bankFields.some(Boolean) && !bankFields.every(Boolean)) {
    throw new ProfileError(400, "은행명, 계좌번호, 예금주는 모두 입력하거나 모두 비워 주세요.");
  }
  if (value.bankAccountNumber) {
    if (!/^[0-9\s-]+$/.test(value.bankAccountNumber)) throw new ProfileError(400, "계좌번호는 숫자와 하이픈만 입력해 주세요.");
    value.bankAccountNumber = value.bankAccountNumber.replace(/[\s-]/g, "");
    if (!/^\d{6,20}$/.test(value.bankAccountNumber)) throw new ProfileError(400, "계좌번호는 6~20자리 숫자로 입력해 주세요.");
  }
  return value;
}

export async function readOwnMemberProfile(userId: number) {
  const [user] = await db.select({ name: usersTable.name, phone: usersTable.phone,
    deletedAt: usersTable.deletedAt, suspendedAt: usersTable.suspendedAt })
    .from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.deletedAt || user.suspendedAt) throw new ProfileError(403, "이 계정의 개인정보를 이용할 수 없습니다.");
  const [bank] = await db.select().from(memberProfilesTable).where(eq(memberProfilesTable.userId, userId));
  return { name: user.name, phone: user.phone, bankName: bank?.bankName ?? null,
    bankAccountNumber: bank?.bankAccountNumber ?? null, bankAccountHolder: bank?.bankAccountHolder ?? null };
}

export async function updateOwnMemberProfile(userId: number, body: unknown) {
  const value = normalize(body);
  await db.transaction(async tx => {
    const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).for("update");
    if (!user || user.deletedAt || user.suspendedAt) throw new ProfileError(403, "이 계정의 개인정보를 수정할 수 없습니다.");
    const [bank] = await tx.select().from(memberProfilesTable).where(eq(memberProfilesTable.userId, userId));
    const phoneChanged = value.phone !== (user.phone ?? null);
    if (phoneChanged && value.phone) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"member-profile-phone:" + value.phone}))`);
      const variants = memberPhoneVariants(value.phone)!;
      const [duplicate] = await tx.select({ id: usersTable.id }).from(usersTable).where(and(
        ne(usersTable.id, userId), isNull(usersTable.deletedAt),
        inArray(sql<string>`regexp_replace(${usersTable.phone}, '[^0-9]', '', 'g')`, variants),
      )).limit(1);
      if (duplicate) throw new ProfileError(409, "이미 사용 중인 휴대폰 번호입니다.");
    }
    const bankChanged = value.bankName !== (bank?.bankName ?? null) ||
      value.bankAccountNumber !== (bank?.bankAccountNumber ?? null) ||
      value.bankAccountHolder !== (bank?.bankAccountHolder ?? null);
    const authStates = { ...user.authStates };
    if (phoneChanged) authStates.phone = false;
    if (bankChanged) authStates.withdraw = false;
    await tx.update(usersTable).set({ name: value.name, phone: value.phone, authStates })
      .where(eq(usersTable.id, userId));
    await tx.insert(memberProfilesTable).values({ userId, bankName: value.bankName,
      bankAccountNumber: value.bankAccountNumber, bankAccountHolder: value.bankAccountHolder })
      .onConflictDoUpdate({ target: memberProfilesTable.userId, set: {
        bankName: value.bankName, bankAccountNumber: value.bankAccountNumber,
        bankAccountHolder: value.bankAccountHolder, updatedAt: new Date(),
      } });
  });
  return readOwnMemberProfile(userId);
}
