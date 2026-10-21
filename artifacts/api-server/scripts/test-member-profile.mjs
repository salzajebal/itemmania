// Isolated self-service profile regression, no production/customer data writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import express from "express";
import vm from "node:vm";
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw new Error("Development-only");
const requireDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireDb("pg");
const original = process.env.DATABASE_URL;
if (!original) throw new Error("Development DB required");
const maintenance = new Pool({ connectionString: original });
const schema = `profile_test_${process.pid}_${Date.now()}`;
let pool, server;
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  await maintenance.query(`CREATE TABLE "${schema}".users (LIKE public.users INCLUDING ALL)`);
  const url = new URL(original); url.searchParams.set("options", `-c search_path=${schema},public`);
  process.env.DATABASE_URL = url.toString();
  const database = await import("@workspace/db");
  pool = database.pool;
  await pool.query("BEGIN");
  await pool.query(await readFile(new URL("./vps-member-profiles.sql", import.meta.url), "utf8"));
  await pool.query("COMMIT");
  await pool.query(`INSERT INTO users(id,email,nickname,name,phone,password_hash,auth_states)
    VALUES(1,'profile-a@example.invalid','A','테스트A',NULL,'not-a-real-password',
      '{"phone":true,"withdraw":true,"email":true,"ipin":false,"excellent":false}'),
      (2,'profile-b@example.invalid','B','테스트B','01000000002','not-a-real-password',
      '{"phone":false,"withdraw":false,"email":false,"ipin":false,"excellent":false}')`);
  const beforeOther = (await pool.query("SELECT * FROM users WHERE id=2")).rows[0];
  const router = (await import("../src/routes/auth.ts")).default;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error() {}, info() {} };
    req.session = req.headers["x-test-actor"] === "admin" ? { adminId: 1, adminRole: "admin" } :
      req.headers["x-test-actor"] ? { userId: Number(req.headers["x-test-actor"]), userRole: "user" } : {};
    next();
  });
  app.use("/api", router);
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const root = `http://127.0.0.1:${server.address().port}/api/auth/profile`;
  async function request(method, body, actor = "1", headers = {}) {
    const r = await fetch(root, { method, headers: { "Content-Type": "application/json",
      ...(actor ? { "x-test-actor": actor } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json(), cache: r.headers.get("cache-control") };
  }
  const input = { name: "테스트 수정", phone: "010-0000-0001", bankName: "테스트은행",
    bankAccountNumber: "000-111-222333", bankAccountHolder: "테스트 예금주" };
  for (const actor of ["", "admin"]) {
    assert.equal((await request("GET", null, actor)).status, 401);
    assert.equal((await request("PATCH", input, actor)).status, 401);
  }
  assert.equal((await request("PATCH", input, "1", { "sec-fetch-site": "cross-site" })).status, 403);
  let result = await request("GET");
  assert.ok(result.cache.includes("no-store"));
  assert.equal(result.data.bankAccountNumber, null);
  assert.equal((await request("PATCH", { ...input, userId: 2 })).status, 400);
  assert.equal((await request("PATCH", { ...input, role: "admin" })).status, 400);
  assert.equal((await request("PATCH", { ...input, bankAccountHolder: "" })).status, 400);
  assert.equal((await request("PATCH", { ...input, name: "<script>" })).status, 400);
  assert.equal((await request("PATCH", { ...input, bankAccountNumber: "123" })).status, 400);
  assert.equal((await request("PATCH", { ...input, phone: "01000000002" })).status, 409);
  result = await request("PATCH", input);
  assert.equal(result.status, 200);
  assert.equal(result.data.phone, "01000000001");
  assert.equal(result.data.bankAccountNumber, "000111222333");
  assert.deepEqual((await request("GET")).data, result.data);
  assert.equal((await request("GET", null, "2")).data.bankAccountNumber, null);
  const user = (await pool.query("SELECT * FROM users WHERE id=1")).rows[0];
  assert.equal(user.password_hash, "not-a-real-password");
  assert.equal(user.email, "profile-a@example.invalid");
  assert.equal(user.role, "user");
  assert.equal(user.auth_states.phone, false);
  assert.equal(user.auth_states.withdraw, false);
  assert.equal(user.auth_states.email, true);
  assert.deepEqual((await pool.query("SELECT * FROM users WHERE id=2")).rows[0], beforeOther);
  const cleared = Object.fromEntries(Object.keys(input).map(k => [k, ""]));
  result = await request("PATCH", cleared);
  assert.deepEqual(result.data, Object.fromEntries(Object.keys(input).map(k => [k, null])));
  await pool.query("UPDATE users SET suspended_at=now() WHERE id=1");
  assert.equal((await request("GET")).status, 403);
  assert.equal((await request("PATCH", input)).status, 403);
  await pool.query("UPDATE users SET suspended_at=NULL,deleted_at=now() WHERE id=1");
  assert.equal((await request("PATCH", input)).status, 403);
  // Ensure generated embedded browser JavaScript is parse-valid.
  const html = (await import("../src/lib/member-profile-view.ts")).renderMemberProfileContent();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1); new vm.Script(scripts[0][1]);
  console.log("PASS: self-only profile GET/PATCH, bank privacy, normalization, persistence, clear, invalid/duplicate inputs, privilege rejection, inactive-account protection, verification reset and JS syntax.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  process.env.DATABASE_URL = original;
  await maintenance.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await maintenance.end();
}
