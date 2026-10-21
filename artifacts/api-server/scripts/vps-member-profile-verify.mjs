// Private, read-only operating acceptance; never changes a member's profile.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import assert from "node:assert/strict";
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [mode, baselinePath] = process.argv.slice(2);
if (!["capture", "verify"].includes(mode) || !baselinePath?.startsWith("/root/")) throw new Error("Invalid arguments");
let cookie;
function request(method, path, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = https.request({ hostname: "127.0.0.1", servername: "ltemmania.com", port: 443,
      method, path, headers: { Host: "ltemmania.com", "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(authenticated && cookie ? { Cookie: cookie } : {}) } }, res => {
      const chunks = []; res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString(),
        cookie: res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; "),
        cache: res.headers["cache-control"], location: res.headers.location }));
    });
    req.on("error", reject); req.setTimeout(15000, () => req.destroy(new Error("Timeout")));
    if (payload) req.write(payload); req.end();
  });
}
try {
  const snapshot = {};
  for (const table of ["users", "orders", "wallets", "escrow_ledger", "chat_rooms", "chat_messages"]) {
    // Member login can legitimately refresh login metadata, never identity/finance.
    const value = table === "users" ? "(to_jsonb(t)-'last_login_ip'-'updated_at')" : "to_jsonb(t)";
    snapshot[table] = (await pool.query(`SELECT md5(coalesce(string_agg(${value}::text,',' ORDER BY id),'')) AS hash FROM ${table} t`)).rows[0].hash;
  }
  if (mode === "capture") {
    await writeFile(baselinePath, JSON.stringify(snapshot), { mode: 0o600 });
    console.log("Private existing-member and finance/conversation evidence captured.");
  } else {
    assert.deepEqual(snapshot, JSON.parse(await readFile(baselinePath, "utf8")));
    await pool.query("SELECT user_id,bank_name,bank_account_number,bank_account_holder FROM member_profiles LIMIT 0");
    const admin = (await pool.query(`SELECT email FROM users WHERE role='admin' AND deleted_at IS NULL
      AND suspended_at IS NULL ORDER BY id LIMIT 1`)).rows[0];
    assert.ok(admin);
    // A real admin-only session must NOT gain access to member bank details.
    let login = await request("POST", "/api/admin/login", { email: admin.email, password: process.env.ADMIN_PASSWORD }, false);
    assert.equal(login.status, 200); cookie = login.cookie;
    assert.equal((await request("GET", "/api/auth/profile")).status, 401);
    await request("POST", "/api/admin/logout"); cookie = null;
    login = await request("POST", "/api/auth/login", { email: admin.email, password: process.env.ADMIN_PASSWORD }, false);
    assert.equal(login.status, 200); cookie = login.cookie; assert.ok(cookie);
    const profile = await request("GET", "/api/auth/profile");
    assert.equal(profile.status, 200); assert.ok(profile.cache?.includes("no-store"));
    assert.deepEqual(Object.keys(JSON.parse(profile.text)).sort(),
      ["name", "phone", "bankName", "bankAccountNumber", "bankAccountHolder"].sort());
    for (const path of ["/myroom/myinfo/myinfo_check.html", "/myroom/myinfo/myinfo_check.html?mobile=1"]) {
      const page = await request("GET", path); assert.equal(page.status, 200);
      assert.ok(page.cache?.includes("no-store"));
      assert.ok(page.text.includes('id="member-profile-form"'));
      assert.ok(page.text.includes('id="profile-bankAccountNumber"'));
      assert.ok(page.text.includes("/api/auth/profile"));
    }
    // Invalid fields must be rejected before any member record is written.
    assert.equal((await request("PATCH", "/api/auth/profile", { userId: 2147483647 })).status, 400);
    assert.equal((await request("GET", "/api/auth/profile", null, false)).status, 401);
    const guestPage = await request("GET", "/myroom/myinfo/myinfo_check.html", null, false);
    assert.equal(guestPage.status, 302); assert.ok(guestPage.location?.startsWith("/login?redirect="));
    assert.deepEqual(JSON.parse((await request("GET", "/api/auth/profile")).text), JSON.parse(profile.text));
    console.log("PASS: original members and all trade/finance/chat evidence unchanged; profile table, PC/mobile forms, native own-member read, strict invalid-write rejection and guest/admin-only denial verified.");
  }
} catch {
  console.error("Private profile acceptance failed; investigate without restoring customer records.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/auth/logout").catch(() => {});
  await pool.end();
}
