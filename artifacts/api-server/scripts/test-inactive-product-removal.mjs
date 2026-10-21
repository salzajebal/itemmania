import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import express from "express";
import vm from "node:vm";
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development-only");
const { Pool } = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg");
const original = process.env.DATABASE_URL;
const maintenance = new Pool({ connectionString: original });
const schema = `inactive_remove_${Date.now()}`;
let pool, server;
try {
  await maintenance.query(`CREATE SCHEMA "${schema}"`);
  const tables = ["users", "products", "orders", "wallets", "chat_rooms", "chat_messages", "escrow_ledger"];
  for (const t of tables) await maintenance.query(`CREATE TABLE "${schema}".${t} (LIKE public.${t} INCLUDING ALL)`);
  const url = new URL(original); url.searchParams.set("options", `-c search_path=${schema},public`);
  process.env.DATABASE_URL = url.toString(); pool = (await import("@workspace/db")).pool;
  await pool.query(await readFile(new URL("./vps-inactive-product-removal.sql", import.meta.url), "utf8"));
  await pool.query(`ALTER TABLE orders ADD FOREIGN KEY(product_id) REFERENCES products(id);
    ALTER TABLE chat_rooms ADD FOREIGN KEY(product_id) REFERENCES products(id);
    INSERT INTO users(id,email,nickname,password_hash,role) VALUES
      (1,'inactive-admin@example.invalid','QA admin','no-login','admin'),
      (2,'inactive-member@example.invalid','QA member','no-login','user');
    INSERT INTO wallets(id,user_id,balance) VALUES(1,2,5000);
    INSERT INTO products(id,itemmania_id,title,price,category,status,seller_grade) VALUES
      (10,'inactive-qa10','QA historical',100,'sell','inactive','gold'),
      (11,'inactive-qa11','QA unlinked',100,'buy','inactive',NULL),
      (12,'inactive-qa12','QA active',100,'sell','active','gold'),
      (13,'inactive-qa13','QA sold',100,'sell','sold','gold'),
      (14,'inactive-qa14','QA ongoing reference',100,'sell','inactive','gold'),
      (15,'inactive-qa15','QA first-stage archive',100,'sell','active','gold');
    INSERT INTO orders(id,buyer_id,seller_id,product_id,product_title,amount,status) VALUES
      (1,2,2,10,'QA historical',100,'completed'),
      (2,2,2,14,'QA ongoing',100,'pending'),
      (3,2,2,15,'QA archive',100,'completed');
    INSERT INTO chat_rooms(id,buyer_id,seller_id,product_id,order_id,status) VALUES(1,2,2,10,1,'ended');
    INSERT INTO chat_messages(id,room_id,sender_id,content) VALUES(1,1,2,'QA preserve');
    INSERT INTO escrow_ledger(id,order_id,type,amount) VALUES(1,1,'release',100)`);
  const snapshots = {};
  for (const t of ["orders", "wallets", "chat_rooms", "chat_messages", "escrow_ledger"]) snapshots[t] = (await pool.query(`SELECT * FROM ${t} ORDER BY id`)).rows;
  const productBefore = (await pool.query("SELECT to_jsonb(p)-'admin_hidden_at'-'admin_hidden_by' AS row FROM products p WHERE id IN(10,11,14) ORDER BY id")).rows;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error() {}, info() {} };
    req.session = req.headers["x-test-actor"] === "admin" ? { adminId: 1, adminRole: "admin" } :
      req.headers["x-test-actor"] === "member" ? { userId: 2, userRole: "user" } : {};
    next();
  });
  app.use("/api", (await import("../src/routes/admin.ts")).default);
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  async function request(method, path, actor = "admin", extra = {}, body) {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json",
      ...(actor ? { "x-test-actor": actor } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  }
  const remove = (id, actor = "admin", extra = {}) => request("DELETE", `/products/${id}/list-entry`, actor, extra);
  for (const a of ["", "member"]) assert.equal((await remove(10, a)).status, 401);
  const key = createHmac("sha256", process.env.SESSION_SECRET || "itemmania-default").update("crawl-key-v1").digest("hex").slice(0, 32);
  assert.equal((await remove(10, "", { "x-crawl-key": key })).status, 401);
  assert.equal((await remove(10, "admin", { "sec-fetch-site": "cross-site" })).status, 403);
  for (const id of ["bad", "0", "-1", "1.5", "2147483648"]) assert.equal((await remove(id)).status, 400);
  assert.equal((await remove(99)).status, 404);
  for (const id of [12, 13]) assert.equal((await remove(id)).status, 409);
  await pool.query("UPDATE users SET suspended_at=now() WHERE id=1");
  assert.equal((await remove(10)).status, 403);
  await pool.query("UPDATE users SET suspended_at=NULL WHERE id=1");
  assert.deepEqual((await remove(10)).data, { ok: true, hidden: true, preserved: true });
  const audit = (await pool.query("SELECT admin_hidden_at,admin_hidden_by FROM products WHERE id=10")).rows[0];
  assert.equal(audit.admin_hidden_by, "admin:1"); assert.ok(audit.admin_hidden_at);
  await Promise.all(Array.from({ length: 4 }, async () => assert.equal((await remove(10)).status, 200)));
  assert.deepEqual((await pool.query("SELECT admin_hidden_at,admin_hidden_by FROM products WHERE id=10")).rows[0], audit);
  assert.equal((await remove(11)).status, 200);
  assert.equal((await remove(14)).status, 200);
  for (const query of ["?status=inactive", "?status=inactive&category=buy", "?status=inactive&category=sell", ""]) {
    const r = await request("GET", "/products" + query);
    assert.equal(r.status, 200); assert.ok(r.data.products.every(p => ![10, 11, 14].includes(p.id)));
    assert.equal(r.data.total, (await pool.query("SELECT count(*)::int AS n FROM products WHERE admin_hidden_at IS NULL AND " +
      (query ? "status='inactive'" : "status<>'inactive'") + (query.includes("category=buy") ? " AND category='buy'" : query.includes("category=sell") ? " AND category='sell'" : ""))).rows[0].n);
  }
  assert.equal((await request("PATCH", "/products/10", "admin", {}, { status: "active" })).status, 404);
  assert.equal((await request("DELETE", "/products/11")).status, 200); // old retries cannot physically delete a hidden unlinked row
  assert.equal((await request("DELETE", "/products/no-grade")).status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await request("DELETE", "/products/15")).data.archived, true);
  assert.equal((await pool.query("SELECT admin_hidden_at FROM products WHERE id=15")).rows[0].admin_hidden_at, null);
  assert.equal((await remove(15)).status, 200);
  assert.deepEqual((await pool.query("SELECT to_jsonb(p)-'admin_hidden_at'-'admin_hidden_by' AS row FROM products p WHERE id IN(10,11,14) ORDER BY id")).rows, productBefore);
  for (const t of Object.keys(snapshots)) assert.deepEqual((await pool.query(`SELECT * FROM ${t} ORDER BY id`)).rows, snapshots[t]);
  const js = await readFile(new URL("../src/admin-script.js", import.meta.url), "utf8");
  const deletion = js.slice(js.indexOf("var deletingProducts={}"), js.indexOf("\nasync function deleteNoGradeProducts"));
  let confirmResult = false, fail = false, calls = [], reloads = 0;
  const button = { disabled: false };
  const ctx = { document: { getElementById: () => ({ querySelectorAll: () => [button] }) },
    confirm: () => confirmResult, showToast() {}, currentProductsPage: 1,
    fetch: async path => { calls.push(path); return { ok: !fail, json: async () => fail ? { error: "QA failure" } : { ok: true, hidden: true, preserved: true } }; },
    loadProducts: async () => { reloads++; } };
  vm.runInNewContext(deletion, ctx);
  await ctx.deleteProduct(10, true); assert.equal(calls.length, 0);
  confirmResult = true; fail = true; await ctx.deleteProduct(10, true);
  assert.equal(button.disabled, false); assert.equal(reloads, 0);
  fail = false; await ctx.deleteProduct(10, true);
  assert.equal(calls.at(-1), "/api/admin/products/10/list-entry"); assert.equal(reloads, 1);
  await ctx.deleteProduct(12, false); assert.equal(calls.at(-1), "/api/admin/products/12");
  assert.ok(js.includes("+(p.status==='inactive')+"));
  // Last-row removal must return from an empty last page to an existing page.
  const render = js.slice(js.indexOf("async function loadProducts(page)"), js.indexOf("\nfunction renderProductsPagination"));
  const elements = {}, pages = [];
  const renderCtx = { currentProductsPage: 2, totalProductsPages: 2,
    document: { getElementById: id => elements[id] ??= { value: "", innerHTML: "" } },
    fetch: async path => { pages.push(path); return { ok: true, json: async () => pages.length === 1
      ? { products: [], total: 1, totalPages: 1, page: 2 }
      : { products: [{ id: 11, status: "inactive", title: "QA" }], total: 1, totalPages: 1, page: 1 } }; },
    renderProductsPagination() {}, escHtml: String, fmtMoney: String, fmtDate: String };
  await vm.runInNewContext(render + ";loadProducts()", renderCtx);
  assert.equal(renderCtx.currentProductsPage, 1); assert.equal(pages.length, 2);
  assert.ok(elements.productsBody.innerHTML.includes("deleteProduct(11,true)"));
  console.log("PASS: inactive-only admin list removal, native permission boundary, retries, filters/counts, old deletion/bulk safety, unchanged products/transactions/balances/chat, UI branch/cancel/failure/retry and last-page fallback.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  await maintenance.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await maintenance.end();
}
