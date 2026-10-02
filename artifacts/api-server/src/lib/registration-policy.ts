import { eq, sql } from "drizzle-orm";
import { db, registrationSettingsTable, usersTable, walletsTable } from "@workspace/db";

const POLICY_KEY = "new_members";
// Shared by every member-creation path and the administrator's policy update.
// ON cannot acknowledge before an already-started creation transaction finishes.
const policyLock = sql`SELECT pg_advisory_xact_lock(183510001, 1)`;

export class RegistrationBlockedError extends Error {
  constructor() {
    super("현재 신규 가입이 중단되었습니다. 기존 회원은 로그인할 수 있습니다.");
  }
}

export async function getRegistrationPolicy() {
  const [setting] = await db.select().from(registrationSettingsTable)
    .where(eq(registrationSettingsTable.key, POLICY_KEY));
  // Missing row means the initial OFF state; missing table/DB failure is an error.
  return { blocked: setting?.blocked ?? false };
}

export async function setRegistrationPolicy(blocked: boolean) {
  return db.transaction(async tx => {
    await tx.execute(policyLock);
    const [setting] = await tx.insert(registrationSettingsTable).values({ key: POLICY_KEY, blocked })
      .onConflictDoUpdate({
        target: registrationSettingsTable.key,
        set: { blocked, updatedAt: new Date() },
      }).returning();
    return { blocked: setting.blocked };
  });
}

export async function createMemberAccount(values: typeof usersTable.$inferInsert) {
  return db.transaction(async tx => {
    await tx.execute(policyLock);
    const [existing] = await tx.select().from(usersTable).where(eq(usersTable.email, values.email));
    if (existing) return { user: existing, created: false };
    const [setting] = await tx.select().from(registrationSettingsTable)
      .where(eq(registrationSettingsTable.key, POLICY_KEY));
    if (setting?.blocked) throw new RegistrationBlockedError();
    const [user] = await tx.insert(usersTable).values(values).returning();
    await tx.insert(walletsTable).values({ userId: user.id, balance: 0 });
    return { user, created: true };
  });
}