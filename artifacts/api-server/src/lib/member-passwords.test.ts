import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool, memberPasswordOriginalsTable, usersTable, walletsTable } from "@workspace/db";
import { changeOwnPassword, generateTemporaryPassword, MemberPasswordError, resetMemberPassword, validateNewPassword } from "./member-passwords";

test("temporary passwords fit login constraints; invalid new passwords are rejected", () => {
  const passwords = new Set(Array.from({ length: 32 }, generateTemporaryPassword));
  assert.equal(passwords.size, 32);
  for (const value of passwords) assert.match(value, /^[A-Za-z0-9_-]{16}$/);
  for (const value of [null, 12345, "", "short", "x".repeat(17), "😀".repeat(19), " Abc12345", "Abc12345 "]) {
    assert.throws(() => validateNewPassword(value), MemberPasswordError);
  }
  validateNewPassword("NewPass123!");
});

test("reset and own change retain the current original separately, revoke target sessions, and retain wallets",
  { skip: process.env.NODE_ENV === "production" }, async () => {
    const prefix = `qa-password-${Date.now()}`;
    const ids: number[] = [];
    const sids = [`${prefix}-member`, `${prefix}-operator`, `${prefix}-other`];
    try {
      const hash = await bcrypt.hash("OriginalQA12!", 4);
      const users = await db.insert(usersTable).values([
        { email: `${prefix}-target`, nickname: "QA password target", passwordHash: hash },
        { email: `${prefix}-other`, nickname: "QA unrelated member", passwordHash: hash },
        { email: `${prefix}-admin`, nickname: "QA password operator", passwordHash: hash, role: "admin" },
      ]).returning({ id: usersTable.id });
      ids.push(...users.map(u => u.id));
      const [target, other, admin] = ids as [number, number, number];
      assert.equal((await db.select().from(memberPasswordOriginalsTable).where(eq(memberPasswordOriginalsTable.userId, target))).length, 0);
      await db.insert(walletsTable).values({ userId: target, balance: 4321 });
      await db.execute(sql`INSERT INTO public.user_sessions(sid,sess,expire) VALUES
        (${sids[0]},${JSON.stringify({ userId: target })}::json,now()+interval '1 day'),
        (${sids[2]},${JSON.stringify({ userId: other })}::json,now()+interval '1 day')`);
      await db.execute(sql`INSERT INTO public.admin_sessions(sid,sess,expire)
        VALUES (${sids[1]},${JSON.stringify({ adminId: admin })}::json,now()+interval '1 day')`);
      const issued = await resetMemberPassword(target);
      let [user] = await db.select().from(usersTable).where(eq(usersTable.id, target));
      assert.notEqual(user.passwordHash, issued);
      assert.ok(await bcrypt.compare(issued, user.passwordHash));
      assert.equal((await db.select().from(memberPasswordOriginalsTable).where(eq(memberPasswordOriginalsTable.userId, target)))[0].password, issued);
      assert.equal(await bcrypt.compare("OriginalQA12!", user.passwordHash), false);
      assert.equal((await db.execute(sql`SELECT sid FROM public.user_sessions WHERE sid=${sids[0]}`)).rows.length, 0);
      assert.equal((await db.execute(sql`SELECT sid FROM public.user_sessions WHERE sid=${sids[2]}`)).rows.length, 1);
      assert.equal((await db.execute(sql`SELECT sid FROM public.admin_sessions WHERE sid=${sids[1]}`)).rows.length, 1);
      await assert.rejects(changeOwnPassword(target, "wrong", "NewQApass12!"), MemberPasswordError);
      await changeOwnPassword(target, issued, "NewQApass12!");
      [user] = await db.select().from(usersTable).where(eq(usersTable.id, target));
      assert.ok(await bcrypt.compare("NewQApass12!", user.passwordHash));
      assert.equal((await db.select().from(memberPasswordOriginalsTable).where(eq(memberPasswordOriginalsTable.userId, target)))[0].password, "NewQApass12!");
      assert.equal(await bcrypt.compare(issued, user.passwordHash), false);
      assert.equal((await db.select().from(walletsTable).where(eq(walletsTable.userId, target)))[0].balance, 4321);
      await assert.rejects(resetMemberPassword(admin), e => e instanceof MemberPasswordError && e.status === 403);
      await db.update(usersTable).set({ suspendedAt: new Date() }).where(eq(usersTable.id, target));
      await assert.rejects(resetMemberPassword(target), e => e instanceof MemberPasswordError && e.status === 409);
      await db.update(usersTable).set({ suspendedAt: null, deletedAt: new Date() }).where(eq(usersTable.id, target));
      await assert.rejects(resetMemberPassword(target), e => e instanceof MemberPasswordError && e.status === 409);
      await assert.rejects(resetMemberPassword(2147483647), e => e instanceof MemberPasswordError && e.status === 404);
    } finally {
      await db.execute(sql`DELETE FROM public.user_sessions WHERE sid in (${sids[0]},${sids[2]})`);
      await db.execute(sql`DELETE FROM public.admin_sessions WHERE sid=${sids[1]}`);
      if (ids.length) {
        await db.delete(walletsTable).where(inArray(walletsTable.userId, ids));
        await db.delete(usersTable).where(inArray(usersTable.id, ids));
      }
      await pool.end();
    }
  });
