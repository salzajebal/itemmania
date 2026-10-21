// Development-only actual HTTP/DB regression in a disposable schema.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import express from "express";
import { createHmac } from "node:crypto";
import vm from "node:vm";
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development-only");
const require = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const original = process.env.DATABASE_URL;
const maintenance = new Pool({ connectionString: original });
const schema = `withdrawal_remove_${Date.now()}`;
let pool, server;
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  for (const table of ["users", "wallets", "withdrawals"]) {
    await maintenance.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  const url = new URL(original); url.searchParams.set("options", `-c search_path=${schema},public`);
  process.env.DATABASE_URL = url.toString();
  pool = (await import("@workspace/db")).pool;
  await pool.query(await readFile(new URL("./vps-withdrawal-list-removal.sql", import.meta.url), "utf8"));
  await pool.query(`INSERT INTO users(id,email,nickname,password_hash,role) VALUES
    (1,'withdrawal-admin@example.invalid','QA admin','no-login','admin'),
    (2,'withdrawal-member@example.invalid','QA member','no-login','user')`);
  await pool.query("INSERT INTO wallets(id,user_id,balance) VALUES(1,2,5000)");
  await pool.query(`INSERT INTO withdrawals(id,user_id,amount,status,bank_name,account_number,account_holder,admin_note,processed_at)
    VALUES (10,2,100,'pending','QA bank','00000000','QA',NULL,NULL),
      (11,2,200,'approved','QA bank','00000000','QA','approved note',now()),
      (12,2,300,'rejected','QA bank','00000000','QA','rejected note',now())`);
  const before = (await pool.query(`SELECT to_jsonb(w)-'admin_deleted_at'-'admin_deleted_by' AS row
    FROM withdrawals w ORDER BY id`)).rows;
  const adminRouter = (await import("../src/routes/admin.ts")).default;
  const walletRouter = (await import("../src/routes/wallet.ts")).default;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error() {}, info() {} };
    req.session = req.headers["x-test-actor"] === "admin"
      ? { adminId: 1, adminRole: "admin" }
      : req.headers["x-test-actor"] === "member" ? { userId: 2, userRole: "user" } : {};
    next();
  });
  app.use("/api", adminRouter, walletRouter);
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method, path, actor = "admin", extra = {}) {
    const r = await fetch(base + path, { method, headers: { ...(actor ? { "x-test-actor": actor } : {}), ...extra } });
    return { status: r.status, data: await r.json() };
  }
  for (const actor of ["", "member"]) assert.equal((await request("DELETE", "/admin/withdrawals/11", actor)).status, 401);
  const crawl = createHmac("sha256", process.env.SESSION_SECRET || "itemmania-default")
    .update("crawl-key-v1").digest("hex").slice(0, 32);
  assert.equal((await request("DELETE", "/admin/withdrawals/11", "", { "x-crawl-key": crawl })).status, 401);
  assert.equal((await request("DELETE", "/admin/withdrawals/11", "admin", { "sec-fetch-site": "cross-site" })).status, 403);
  for (const id of ["bad", "0", "-1", "1.5", "2147483648"]) {
    assert.equal((await request("DELETE", "/admin/withdrawals/" + id)).status, 400);
  }
  assert.equal((await request("DELETE", "/admin/withdrawals/99")).status, 404);
  assert.equal((await request("DELETE", "/admin/withdrawals/10")).status, 409);
  assert.equal((await request("GET", "/admin/withdrawals?status=bad")).status, 400);
  await pool.query("UPDATE users SET suspended_at=now() WHERE id=1");
  assert.equal((await request("DELETE", "/admin/withdrawals/11")).status, 403);
  await pool.query("UPDATE users SET suspended_at=NULL WHERE id=1");
  assert.deepEqual((await request("DELETE", "/admin/withdrawals/11")).data, { ok: true, preserved: true });
  const firstAudit = (await pool.query("SELECT admin_deleted_at,admin_deleted_by FROM withdrawals WHERE id=11")).rows[0];
  assert.equal(firstAudit.admin_deleted_by, "admin:1"); assert.ok(firstAudit.admin_deleted_at);
  await Promise.all(Array.from({ length: 5 }, async () => {
    assert.equal((await request("DELETE", "/admin/withdrawals/11")).status, 200);
  }));
  assert.deepEqual((await pool.query("SELECT admin_deleted_at,admin_deleted_by FROM withdrawals WHERE id=11")).rows[0], firstAudit);
  assert.deepEqual((await request("GET", "/admin/withdrawals")).data.map(w => w.id).sort(), [10, 12]);
  assert.deepEqual((await request("GET", "/admin/withdrawals?status=approved")).data, []);
  assert.equal((await request("DELETE", "/admin/withdrawals/12")).status, 200);
  assert.deepEqual((await request("GET", "/admin/withdrawals")).data.map(w => w.id), [10]);
  assert.equal((await request("GET", "/wallet/withdrawals", "member")).data.length, 3);
  assert.equal(Number((await pool.query("SELECT balance FROM wallets WHERE user_id=2")).rows[0].balance), 5000);
  assert.deepEqual((await pool.query(`SELECT to_jsonb(w)-'admin_deleted_at'-'admin_deleted_by' AS row
    FROM withdrawals w ORDER BY id`)).rows, before);
  // Match the existing 10-column header: amount/bank/account/holder and actions.
  const script = await readFile(new URL("../src/admin-script.js", import.meta.url), "utf8");
  const render = script.slice(script.indexOf("async function loadWithdrawals(){"), script.indexOf("var removingWithdrawals={}"));
  const elements = {};
  await vm.runInNewContext(render + ";loadWithdrawals()", {
    document: { getElementById(id) { return elements[id] ??= { value: "", innerHTML: "" }; } },
    fetch: async () => ({ ok: true, json: async () => [
      { id: 10, userId: 2, status: "pending", amount: 100, method: "bank", bankName: "QA bank", accountNumber: "000", accountHolder: "QA" },
      { id: 11, userId: 2, status: "approved", amount: 200, method: "phone", phoneNumber: "01000000000" },
    ] }),
    escHtml: String, fmtMoney: n => n + "원", fmtDate: () => "QA date",
  });
  const rows = elements.withdrawalsBody.innerHTML.match(/<tr[\s\S]*?<\/tr>/g);
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal((row.match(/<td>/g) ?? []).length, 10);
  assert.ok(rows[0].includes("<td>100원</td><td>QA bank</td><td>000</td><td>QA</td>"));
  assert.ok(!rows[0].includes("removeWithdrawal("));
  assert.ok(rows[1].includes("<td>200원</td><td>📱 휴대폰</td><td>01000000000</td><td>-</td>"));
  assert.ok(rows[1].includes("removeWithdrawal(11)"));
  console.log("PASS: native-admin-only, pending protection, strict IDs, processed-list removal, filters, retry/concurrency audit stability, unchanged member history/amounts/status/bank details/balances.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  await maintenance.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await maintenance.end();
}
