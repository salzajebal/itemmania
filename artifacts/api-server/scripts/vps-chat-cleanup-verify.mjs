// Root-private, read-only production acceptance; never removes real chat rooms.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import assert from "node:assert/strict";
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [mode, baselinePath] = process.argv.slice(2);
if (!["capture", "verify"].includes(mode) || !baselinePath?.startsWith("/root/")) {
  throw new Error("Invalid arguments");
}
let cookie;
function request(method, path, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "127.0.0.1", servername: "ltemmania.com", port: 443, method, path,
      headers: { Host: "ltemmania.com", "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(authenticated && cookie ? { Cookie: cookie } : {}) },
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode,
        text: Buffer.concat(chunks).toString(),
        cookie: res.headers["set-cookie"]?.map(v => v.split(";")[0]).join("; "),
        cache: res.headers["cache-control"] }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}
try {
  const snapshot = (await pool.query(`SELECT
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY id),'')) FROM orders t) AS orders,
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY id),'')) FROM wallets t) AS wallets,
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY id),'')) FROM escrow_ledger t) AS escrow,
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY id),'')) FROM chat_messages t) AS messages,
    (SELECT md5(coalesce(string_agg((to_jsonb(t)-'admin_hidden_at'-'admin_hidden_by')::text,',' ORDER BY id),'')) FROM chat_rooms t) AS rooms`)).rows[0];
  if (mode === "capture") {
    await writeFile(baselinePath, JSON.stringify(snapshot), { mode: 0o600 });
    console.log("Private financial and conversation evidence captured.");
  } else {
    assert.deepEqual(snapshot, JSON.parse(await readFile(baselinePath, "utf8")),
      "Evidence changed; investigate concurrent activity without restoring");
    console.log("Orders, wallets, escrow, messages and original room fields unchanged.");
    await pool.query("SELECT admin_hidden_at,admin_hidden_by FROM chat_rooms LIMIT 0");
    const admin = (await pool.query(`SELECT email FROM users WHERE role='admin'
      AND deleted_at IS NULL AND suspended_at IS NULL ORDER BY id LIMIT 1`)).rows[0];
    assert.ok(admin);
    const login = await request("POST", "/api/admin/login",
      { email: admin.email, password: process.env.ADMIN_PASSWORD }, false);
    assert.equal(login.status, 200);
    assert.ok(login.cookie?.includes("admin.sid="));
    cookie = login.cookie;
    const page = await request("GET", "/banana777");
    assert.equal(page.status, 200);
    assert.ok(page.text.includes("function hideChatRoom(id)"));
    assert.ok(page.text.includes('onclick="hideChatRoom('));
    const hidden = new Set((await pool.query("SELECT id FROM chat_rooms WHERE admin_hidden_at IS NOT NULL")).rows.map(r => r.id));
    for (const suffix of ["", "?includeDeleted=1"]) {
      const response = await request("GET", "/api/admin/chat-rooms" + suffix);
      assert.equal(response.status, 200);
      assert.ok(response.cache?.includes("no-store"));
      const rows = JSON.parse(response.text);
      assert.ok(Array.isArray(rows));
      for (const room of rows) {
        assert.ok(!hidden.has(room.id));
        assert.ok(suffix || !room.adminDeletedAt);
        assert.equal(room.canHide, !!room.adminDeletedAt &&
          (room.orderId === null || ["ended", "cancelled", "rejected"].includes(room.status)));
      }
    }
    assert.equal((await request("DELETE", "/api/admin/chat-rooms/0/list-entry")).status, 400);
    // Confirm this ID is absent before using it for a non-mutating 404 check.
    assert.equal((await pool.query("SELECT id FROM chat_rooms WHERE id=2147483647")).rowCount, 0);
    assert.equal((await request("DELETE", "/api/admin/chat-rooms/2147483647/list-entry")).status, 404);
    assert.ok([401, 403].includes((await request("DELETE", "/api/admin/chat-rooms/0/list-entry", null, false)).status));
    console.log("PASS: native admin controls, both list modes, eligibility, invalid/missing IDs and guest denial; no operating chat removed.");
  }
} catch (error) {
  // Assertion/HTTP contents and customer data are never printed.
  console.error("Chat cleanup acceptance failed; inspect privately without restoring records.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/admin/logout").catch(() => {});
  await pool.end();
}
