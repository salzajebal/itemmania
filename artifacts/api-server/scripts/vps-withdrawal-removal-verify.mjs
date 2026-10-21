// Root-private operating acceptance. No real withdrawal is removed or mutated.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import assert from "node:assert/strict";
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [mode, baseline] = process.argv.slice(2);
if (!["capture", "verify"].includes(mode) || !baseline?.startsWith("/root/")) throw Error("Invalid arguments");
let cookie;
function request(method, path, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const r = https.request({ hostname: "127.0.0.1", servername: "ltemmania.com", port: 443, method, path,
      headers: { Host: "ltemmania.com", "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(authenticated && cookie ? { Cookie: cookie } : {}) } }, res => {
      const chunks = []; res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString(),
        cookie: res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; "), cache: res.headers["cache-control"] }));
    });
    r.on("error", reject); r.setTimeout(15000, () => r.destroy(Error("Timeout")));
    if (payload) r.write(payload); r.end();
  });
}
try {
  const snapshot = {};
  for (const table of ["users", "products", "withdrawals", "orders", "wallets", "escrow_ledger", "chat_rooms", "chat_messages"]) {
    const value = table === "users" ? "(to_jsonb(t)-'last_login_ip'-'updated_at')" :
      table === "withdrawals" ? "(to_jsonb(t)-'admin_deleted_at'-'admin_deleted_by')" :
      table === "products" ? "(to_jsonb(t)-'admin_hidden_at'-'admin_hidden_by')" : "to_jsonb(t)";
    snapshot[table] = (await pool.query(`SELECT md5(coalesce(string_agg(${value}::text,',' ORDER BY id),'')) AS hash FROM ${table} t`)).rows[0].hash;
  }
  if (mode === "capture") {
    await writeFile(baseline, JSON.stringify(snapshot), { mode: 0o600 });
    console.log("Private withdrawal/member/finance/conversation baseline captured.");
  } else {
    assert.deepEqual(snapshot, JSON.parse(await readFile(baseline, "utf8")));
    await pool.query("SELECT admin_deleted_at,admin_deleted_by FROM withdrawals LIMIT 0");
    const admin = (await pool.query("SELECT email FROM users WHERE role='admin' AND deleted_at IS NULL AND suspended_at IS NULL ORDER BY id LIMIT 1")).rows[0];
    assert.ok(admin);
    const login = await request("POST", "/api/admin/login", { email: admin.email, password: process.env.ADMIN_PASSWORD }, false);
    assert.equal(login.status, 200); cookie = login.cookie; assert.ok(cookie);
    for (const status of ["", "pending", "approved", "rejected"]) {
      const r = await request("GET", "/api/admin/withdrawals" + (status ? "?status=" + status : ""));
      assert.equal(r.status, 200); assert.ok(r.cache?.includes("no-store"));
      const actual = JSON.parse(r.text).map(w => w.id).sort((a, b) => a - b);
      const expected = (await pool.query("SELECT id FROM withdrawals WHERE admin_deleted_at IS NULL AND ($1='' OR status::text=$1) ORDER BY id", [status])).rows.map(w => w.id);
      assert.deepEqual(actual, expected);
    }
    assert.equal((await request("DELETE", "/api/admin/withdrawals/0")).status, 400);
    await pool.query("SELECT admin_hidden_at,admin_hidden_by FROM products LIMIT 0");
    for (const status of ["", "inactive", "active", "sold"]) {
      const r = await request("GET", "/api/admin/products?limit=100" + (status ? "&status=" + status : ""));
      assert.equal(r.status, 200); assert.ok(r.cache?.includes("no-store"));
      const data = JSON.parse(r.text);
      const expected = (await pool.query("SELECT count(*)::int AS n FROM products WHERE admin_hidden_at IS NULL AND (($1='' AND status<>'inactive') OR status::text=$1)", [status])).rows[0].n;
      assert.equal(data.total, expected);
      for (const product of data.products) {
        const row = (await pool.query("SELECT admin_hidden_at FROM products WHERE id=$1", [product.id])).rows[0];
        assert.equal(row.admin_hidden_at, null);
      }
    }
    assert.equal((await request("DELETE", "/api/admin/products/0/list-entry")).status, 400);
    // Never DELETE a real ID: a pending record could concurrently become processed.
    // Pending denial and successful removal are exercised only with development fixtures.
    assert.equal((await request("DELETE", "/api/admin/withdrawals/0", null, false)).status, 401);
    console.log("PASS: operating product/withdrawal lists, status counts, private caching and invalid-ID denial; original products, withdrawals, balances, members and trade/chat evidence unchanged.");
  }
} catch {
  console.error("Withdrawal-removal operating acceptance failed; investigate without restoring customer data.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/admin/logout").catch(() => {});
  await pool.end();
}
