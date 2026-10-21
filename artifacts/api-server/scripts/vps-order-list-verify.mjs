import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";

// Read-only operating acceptance. No actual order deletion or customer messages.
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [mode, baselinePath] = process.argv.slice(2);
if (!["capture", "verify"].includes(mode) || !baselinePath?.startsWith("/root/")) {
  throw new Error("Invalid verification arguments");
}
let cookie;
function request(method, path, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "127.0.0.1", servername: "ltemmania.com", port: 443,
      method, path, headers: {
        Host: "ltemmania.com", "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({
        status: res.statusCode, text: Buffer.concat(chunks).toString(),
        cookie: res.headers["set-cookie"]?.map(v => v.split(";")[0]).join("; "),
        cache: res.headers["cache-control"],
      }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Request timed out")));
    if (payload) req.write(payload);
    req.end();
  });
}
try {
  const snapshot = (await pool.query(`SELECT
    (SELECT count(*) FROM orders) AS orders,
    (SELECT md5(coalesce(string_agg(
      jsonb_build_array(id,buyer_id,seller_id,product_id,product_title,amount,
      fee_amount,status,cancel_reason,admin_deleted_at,admin_deleted_by,
      created_at,updated_at)::text, ',' ORDER BY id),'')) FROM orders) AS order_evidence,
    (SELECT md5(coalesce(string_agg(to_jsonb(e)::text, ',' ORDER BY id),'')) FROM escrow_ledger e) AS escrow_evidence,
    (SELECT md5(coalesce(string_agg(to_jsonb(w)::text, ',' ORDER BY id),'')) FROM wallets w) AS wallets,
    (SELECT count(*) FROM chat_rooms) AS rooms,
    (SELECT count(*) FROM chat_messages) AS messages`)).rows[0];
  if (mode === "capture") {
    await writeFile(baselinePath, JSON.stringify(snapshot), { mode: 0o600 });
    console.log("Private order/escrow/wallet evidence baseline captured.");
  } else {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
    for (const key of Object.keys(snapshot)) {
      if (baseline[key] !== snapshot[key]) {
        throw new Error("Operating activity changed evidence; investigate without restoring");
      }
    }
    await pool.query("SELECT admin_hidden_at,admin_hidden_by FROM orders LIMIT 0");
    console.log("Original orders, escrow, wallets and conversation counts preserved.");
    const admin = (await pool.query(`SELECT email FROM users WHERE role='admin'
      AND deleted_at IS NULL AND suspended_at IS NULL ORDER BY id LIMIT 1`)).rows[0];
    const login = await request("POST", "/api/admin/login", {
      email: admin.email, password: process.env.ADMIN_PASSWORD,
    }, false);
    if (login.status !== 200 || !login.cookie?.includes("admin.sid=")) {
      throw new Error("Admin acceptance login failed");
    }
    cookie = login.cookie;
    const page = await request("GET", "/banana777");
    if (page.status !== 200 || !page.text.includes("function hideOrder(id)") ||
        !page.text.includes("목록에서 제거") || !page.text.includes("/list-entry")) {
      throw new Error("Operating admin list controls missing");
    }
    const hidden = new Set((await pool.query(
      "SELECT id FROM orders WHERE admin_hidden_at IS NOT NULL"
    )).rows.map(r => r.id));
    for (const suffix of ["", "?includeDeleted=1"]) {
      const result = await request("GET", `/api/admin/orders${suffix}`);
      const rows = JSON.parse(result.text);
      if (result.status !== 200 || !Array.isArray(rows) || !result.cache?.includes("no-store")) {
        throw new Error("Operating admin list response invalid");
      }
      for (const row of rows) {
        const canHide = !!row.adminDeletedAt && ["completed", "cancelled"].includes(row.status);
        if (hidden.has(row.id) || row.canHide !== canHide || (!suffix && row.adminDeletedAt)) {
          throw new Error("Operating list exclusion or permissions invalid");
        }
      }
    }
    // Only invalid/nonexistent IDs: never mutate a real operating order.
    const invalid = await request("DELETE", "/api/admin/orders/0/list-entry");
    const missing = await request("DELETE", "/api/admin/orders/2147483647/list-entry");
    const guest = await request("DELETE", "/api/admin/orders/0/list-entry", null, false);
    if (invalid.status !== 400 || missing.status !== 404 || ![401, 403].includes(guest.status)) {
      throw new Error("Operating order cleanup validation/access denial invalid");
    }
    console.log("Operating controls, both list modes, validation and guest denial verified without deleting real orders.");
  }
} catch {
  // Never print SQL/HTTP payloads, cookies, credentials or customer records.
  console.error("Order-list acceptance failed; inspect privately without resetting operating records.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/admin/logout").catch(() => {});
  await pool.end();
}
