// Development-only isolated schema: never inserts/deletes operating records.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import vm from "node:vm";
import express from "express";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Development-only test");
}
const requireDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireDb("pg");
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) throw new Error("Development DATABASE_URL is required");
const maintenance = new Pool({ connectionString: originalUrl });
const schema = `chat_cleanup_test_${process.pid}_${Date.now()}`;
let pool, server;
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  for (const name of ["users", "products", "orders", "wallets", "escrow_ledger", "chat_rooms", "chat_messages"]) {
    await maintenance.query(`CREATE TABLE "${schema}"."${name}" (LIKE public."${name}" INCLUDING DEFAULTS)`);
  }
  // Explicit IDs avoid advancing the public serial sequences copied by LIKE.
  const url = new URL(originalUrl);
  url.searchParams.set("options", `-c search_path=${schema},public`);
  process.env.DATABASE_URL = url.toString();
  process.env.SESSION_SECRET = "isolated-chat-cleanup-test";
  const database = await import("@workspace/db");
  pool = database.pool;
  await pool.query("BEGIN");
  await pool.query(await readFile(new URL("./vps-chat-list-cleanup.sql", import.meta.url), "utf8"));
  await pool.query("COMMIT");
  await pool.query(`INSERT INTO users (id,email,nickname,password_hash,role)
    VALUES (1,'fixture-admin@example.invalid','Admin','unused','admin'),
           (2,'fixture-user@example.invalid','Member','unused','user')`);
  await pool.query(`INSERT INTO orders (id,buyer_id,seller_id,product_id,product_title,amount,fee_amount,status)
    VALUES (999,1,2,0,'Synthetic test',1000,0,'completed')`);
  await pool.query("INSERT INTO wallets (id,user_id,balance) VALUES (1,1,5000),(2,2,6000)");
  await pool.query(`INSERT INTO chat_rooms (id,buyer_id,seller_id,order_id,status)
    VALUES (100,1,2,999,'ended'),(101,1,2,999,'active'),
           (102,1,2,NULL,'pending'),(103,1,2,999,'cancelled'),(104,1,2,999,'rejected')`);
  await pool.query("INSERT INTO chat_messages (id,room_id,sender_id,content) VALUES (1,100,2,'Preserve this message')");
  const evidence = async () => (await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM orders t) AS orders,
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM wallets t) AS wallets,
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM escrow_ledger t) AS escrow,
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM chat_messages t) AS messages,
    (SELECT jsonb_agg(to_jsonb(t)-'admin_deleted_at'-'admin_deleted_by'-'admin_hidden_at'-'admin_hidden_by' ORDER BY id)
      FROM chat_rooms t) AS rooms`)).rows[0];
  const baseline = await evidence();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { info() {}, error() {} };
    req.session = req.headers["x-test-actor"] === "admin" ? { adminId: 1, adminRole: "admin" } :
      req.headers["x-test-actor"] === "member" ? { userId: 2, userRole: "user" } : {};
    next();
  });
  app.use("/api", (await import("../src/routes/admin.ts")).default);
  server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const root = `http://127.0.0.1:${server.address().port}/api/admin/chat-rooms`;
  async function request(method, suffix = "", actor = "admin", crawl = false) {
    const headers = { "x-test-actor": actor };
    if (crawl) headers["x-crawl-key"] = createHmac("sha256", process.env.SESSION_SECRET)
      .update("crawl-key-v1").digest("hex").slice(0, 32);
    const result = await fetch(root + suffix, { method, headers });
    return { status: result.status, data: await result.json(), cache: result.headers.get("cache-control") };
  }
  assert.equal((await request("DELETE", "/100/list-entry")).status, 409);
  assert.equal((await request("DELETE", "/101")).status, 409);
  assert.equal((await request("DELETE", "/0/list-entry")).status, 400);
  assert.equal((await request("DELETE", "/2147483647/list-entry")).status, 404);
  for (const actor of ["guest", "member"]) {
    assert.ok([401, 403].includes((await request("DELETE", "/100/list-entry", actor)).status));
  }
  assert.equal((await request("DELETE", "/100/list-entry", "guest", true)).status, 403);
  assert.equal((await request("DELETE", "/100")).status, 200);
  const first = (await pool.query("SELECT * FROM chat_rooms WHERE id=100")).rows[0];
  assert.equal(first.admin_hidden_at, null);
  assert.equal(first.admin_deleted_by, "admin:1");
  assert.ok(!(await request("GET")).data.some(r => r.id === 100));
  let list = await request("GET", "?includeDeleted=1");
  assert.ok(list.cache.includes("no-store"));
  assert.equal(list.data.find(r => r.id === 100).canHide, true);
  assert.equal((await request("DELETE", "/100")).status, 200);
  assert.equal((await request("DELETE", "/100/list-entry")).status, 200);
  const hidden = (await pool.query("SELECT * FROM chat_rooms WHERE id=100")).rows[0];
  assert.equal(hidden.admin_deleted_at.toISOString(), first.admin_deleted_at.toISOString());
  assert.equal(hidden.admin_deleted_by, first.admin_deleted_by);
  assert.equal(hidden.admin_hidden_by, "admin:1");
  await request("DELETE", "/100/list-entry");
  const retried = (await pool.query("SELECT * FROM chat_rooms WHERE id=100")).rows[0];
  assert.equal(retried.admin_hidden_at.toISOString(), hidden.admin_hidden_at.toISOString());
  for (const suffix of ["", "?includeDeleted=1"]) {
    assert.ok(!(await request("GET", suffix)).data.some(r => r.id === 100));
  }
  for (const id of [102, 103, 104]) {
    assert.equal((await request("DELETE", `/${id}`)).status, 200);
    assert.equal((await request("DELETE", `/${id}/list-entry`)).status, 200);
  }
  // Even an inconsistently pre-deleted active linked record remains protected.
  await pool.query("UPDATE chat_rooms SET admin_deleted_at=now() WHERE id=101");
  assert.equal((await request("DELETE", "/101/list-entry")).status, 409);
  assert.deepEqual(await evidence(), baseline);

  // Exercise the actual rendered controls, confirmation, errors and refresh.
  const source = await readFile(new URL("../src/admin-script.js", import.meta.url), "utf8");
  const elements = {
    chatroomsBody: { innerHTML: "" }, chatroomStatusFilter: { value: "" },
    chatroomsIncludeDeleted: { checked: true }, "hide-chatroom-100": { disabled: false },
  };
  let calls = [], confirm = true, fail = false;
  const context = vm.createContext({
    document: { getElementById: id => elements[id] }, URLSearchParams,
    escHtml: String, fmtDate: String, fmtMoney: String, showToast() {},
    confirm: () => confirm,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: !fail, json: async () => fail ? { error: "Expected test failure" } :
        options?.method === "DELETE" ? { ok: true, preserved: true } :
        [{ id: 100, status: "ended", adminDeletedAt: "2026-01-01", canHide: true }] };
    },
  });
  vm.runInContext(source.slice(source.indexOf("async function loadChatRooms()"),
    source.indexOf("// ── IP 차단")), context);
  await context.loadChatRooms();
  assert.ok(elements.chatroomsBody.innerHTML.includes('onclick="hideChatRoom(100)"'));
  assert.ok(elements.chatroomsBody.innerHTML.includes("목록에서 제거"));
  calls = []; confirm = false;
  await context.hideChatRoom(100);
  assert.equal(calls.length, 0);
  confirm = true;
  await context.hideChatRoom(100);
  assert.equal(calls[0].url, "/api/admin/chat-rooms/100/list-entry");
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[1].url, "/api/admin/chat-rooms?includeDeleted=1");
  fail = true;
  await context.hideChatRoom(100);
  assert.equal(elements["hide-chatroom-100"].disabled, false);
  console.log("PASS: isolated HTTP cleanup, both list modes, retries, permissions, active protection, preserved evidence and UI confirmation/refresh/error.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  process.env.DATABASE_URL = originalUrl;
  await maintenance.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await maintenance.end();
}
