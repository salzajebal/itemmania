import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool, usersTable, walletsTable, productsTable, ordersTable, escrowLedgerTable,
  withdrawalsTable, chatRoomsTable, chatMessagesTable } from "@workspace/db";
import { changeMemberBalance, removeMember, MemberActionError } from "./admin-member-actions";

after(() => pool.end());

test("development-only wallet updates and archive preserve financial and chat references", async () => {
  assert.notEqual(process.env.NODE_ENV, "production", "Never run financial fixture tests on production");
  const prefix = `member-actions-${randomUUID()}`;
  const members = await db.insert(usersTable).values([0, 1].map(n => ({
    email: `${prefix}-${n}`, nickname: `QA member ${n}`, passwordHash: "synthetic-test-no-login",
  }))).returning({ id: usersTable.id });
  const [a, b] = members.map(m => m.id);
  let orderId: number | undefined, roomId: number | undefined, productId: number | undefined;
  const sid = `synthetic-${prefix}`;
  try {
    assert.equal(await changeMemberBalance(a, { amount: 10000, mode: "set" }), 10000);
    assert.equal(await changeMemberBalance(a, { amount: 3000, mode: "set" }), 3000);
    assert.equal(await changeMemberBalance(a, { amount: 0, mode: "set" }), 0);
    await Promise.all(Array.from({ length: 10 }, () => changeMemberBalance(a, { amount: 100, mode: "add" })));
    assert.equal((await db.select().from(walletsTable).where(eq(walletsTable.userId, a)))[0].balance, 1000);
    await assert.rejects(changeMemberBalance(2147483647, { amount: 1, mode: "set" }),
      (e: unknown) => e instanceof MemberActionError && e.status === 404);
    const [product] = await db.insert(productsTable).values({
      itemmaniaid: prefix, title: "QA preserved listing", price: 1000, sellerId: a, category: "sell",
    }).returning({ id: productsTable.id });
    productId = product.id;
    const [order] = await db.insert(ordersTable).values({
      buyerId: a, sellerId: b, productId, productTitle: "QA preserved order",
      amount: 100, status: "pending",
    }).returning({ id: ordersTable.id });
    orderId = order.id;
    await assert.rejects(removeMember(a, b), (e: unknown) => e instanceof MemberActionError && e.status === 409);
    assert.equal((await db.select().from(usersTable).where(eq(usersTable.id, a)))[0].deletedAt, null);
    await db.update(ordersTable).set({ status: "completed" }).where(eq(ordersTable.id, orderId));
    await db.insert(escrowLedgerTable).values({ orderId, type: "release", amount: 100 });
    const [room] = await db.insert(chatRoomsTable).values({
      orderId, productId, buyerId: a, sellerId: b, status: "ended",
    }).returning({ id: chatRoomsTable.id });
    roomId = room.id;
    await db.insert(chatMessagesTable).values({ roomId, senderId: a, content: "QA preserved message" });
    const [withdrawal] = await db.insert(withdrawalsTable).values({ userId: a, amount: 100, status: "pending" })
      .returning({ id: withdrawalsTable.id });
    await assert.rejects(removeMember(a, b), (e: unknown) => e instanceof MemberActionError && e.status === 409);
    await db.update(withdrawalsTable).set({ status: "rejected" }).where(eq(withdrawalsTable.id, withdrawal.id));
    await db.execute(sql`INSERT INTO user_sessions(sid,sess,expire)
      VALUES (${sid},${JSON.stringify({ userId: a })}::json,now()+interval '1 day')`);
    await removeMember(a, b);
    const [archived] = await db.select().from(usersTable).where(eq(usersTable.id, a));
    assert.ok(archived.deletedAt);
    assert.equal(archived.deletedBy, String(b));
    assert.equal((await db.select().from(walletsTable).where(eq(walletsTable.userId, a)))[0].balance, 1000);
    assert.equal((await db.select().from(ordersTable).where(eq(ordersTable.id, orderId))).length, 1);
    assert.equal((await db.select().from(escrowLedgerTable).where(eq(escrowLedgerTable.orderId, orderId))).length, 1);
    assert.equal((await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId))).length, 1);
    assert.equal((await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.roomId, roomId))).length, 1);
    assert.equal((await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, withdrawal.id))).length, 1);
    assert.equal((await db.select().from(productsTable).where(eq(productsTable.id, productId)))[0].status, "inactive");
    const revoked = await db.execute(sql`SELECT sid FROM user_sessions WHERE sid=${sid}`);
    assert.equal(revoked.rows.length, 0);
    await removeMember(a, b);
    await assert.rejects(changeMemberBalance(a, { amount: 0, mode: "set" }),
      (e: unknown) => e instanceof MemberActionError && e.status === 409);
    const [admin] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
    if (admin) await assert.rejects(removeMember(admin.id, b),
      (e: unknown) => e instanceof MemberActionError && e.status === 403);
  } finally {
    // Remove only fixtures created in this test; never sweep historical data.
    if (roomId) {
      await db.delete(chatMessagesTable).where(eq(chatMessagesTable.roomId, roomId));
      await db.delete(chatRoomsTable).where(eq(chatRoomsTable.id, roomId));
    }
    if (orderId) {
      await db.delete(escrowLedgerTable).where(eq(escrowLedgerTable.orderId, orderId));
      await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    }
    await db.delete(withdrawalsTable).where(inArray(withdrawalsTable.userId, [a, b]));
    if (productId) await db.delete(productsTable).where(eq(productsTable.id, productId));
    await db.execute(sql`DELETE FROM user_sessions WHERE sid=${sid}`);
    await db.delete(walletsTable).where(inArray(walletsTable.userId, [a, b]));
    await db.delete(usersTable).where(inArray(usersTable.id, [a, b]));
  }
});
