import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";

// External VPS acceptance only. Never return real member originals or cookies.
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [mode, baselinePath] = process.argv.slice(2);
if (!["capture", "verify"].includes(mode) || !baselinePath?.startsWith("/root/")) {
  throw new Error("Invalid verification arguments");
}
let cookie;
function request(method, pathname, body, useCookie = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "127.0.0.1", servername: "ltemmania.com", port: 443,
      method, path: pathname,
      headers: {
        Host: "ltemmania.com", "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(useCookie && cookie ? { Cookie: cookie } : {}),
      },
    }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        text: Buffer.concat(chunks).toString(),
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
    (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM wallets) AS wallets,
    (SELECT count(*) FROM products) AS products,
    (SELECT count(*) FROM orders) AS orders,
    (SELECT count(*) FROM chat_rooms) AS chat_rooms,
    (SELECT count(*) FROM chat_messages) AS chat_messages,
    (SELECT md5(coalesce(string_agg(id::text || ':' || password_hash, ',' ORDER BY id),''))
       FROM users WHERE role <> 'admin') AS member_hashes,
    (SELECT md5(coalesce(string_agg(id::text || ':' || user_id::text || ':' || balance::text,
       ',' ORDER BY id),'')) FROM wallets) AS wallet_balances`)).rows[0];
  if (mode === "capture") {
    await writeFile(baselinePath, JSON.stringify(snapshot), { mode: 0o600 });
    console.log("Private pre-release count/password-hash/wallet fingerprint captured.");
  } else {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
    for (const key of ["users", "wallets", "products", "orders", "chat_rooms", "chat_messages"]) {
      if (Number(snapshot[key]) < Number(baseline[key])) throw new Error("Record count decreased; investigate concurrent activity");
    }
    if (baseline.member_hashes !== snapshot.member_hashes ||
        baseline.wallet_balances !== snapshot.wallet_balances) {
      throw new Error("Member hash/wallet fingerprint changed; investigate without restoring");
    }
    console.log("Existing member hashes, wallet balances and record counts preserved.");
    const columns = (await pool.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='member_password_originals'`)).rows;
    if (!["user_id", "password", "updated_at"].every(k => columns.some(c => c.column_name === k))) {
      throw new Error("Original-password schema missing");
    }
    const admin = (await pool.query("SELECT email FROM users WHERE role='admin' AND deleted_at IS NULL AND suspended_at IS NULL ORDER BY id LIMIT 1")).rows[0];
    const login = await request("POST", "/api/admin/login", {
      email: admin.email, password: process.env.ADMIN_PASSWORD,
    }, false);
    if (login.status !== 200 || !login.cookie?.includes("admin.sid=")) throw new Error("Administrator login failed");
    cookie = login.cookie;
    const page = await request("GET", "/banana777");
    if (page.status !== 200 || !page.text.includes('id="userPasswordViewBtn"') ||
        !page.text.includes("변경 적용 이후")) throw new Error("Administrator UI missing");
    const target = (await pool.query(`SELECT u.id FROM users u
      LEFT JOIN member_password_originals p ON p.user_id=u.id
      WHERE u.role='user' AND u.deleted_at IS NULL AND u.suspended_at IS NULL
      AND p.user_id IS NULL ORDER BY u.id LIMIT 1`)).rows[0];
    if (!target) throw new Error("No legacy member available for read-only lookup verification");
    const view = await request("POST", `/api/admin/users/${target.id}/password-view`, {
      adminPassword: process.env.ADMIN_PASSWORD,
    });
    if (view.status !== 200 || JSON.parse(view.text).password !== null ||
        !view.cache?.includes("no-store")) throw new Error("Legacy no-original response failed");
    const denied = await request("POST", `/api/admin/users/${target.id}/password-view`, {
      adminPassword: "invalid-verification-input",
    });
    if (denied.status !== 403) throw new Error("Administrator reauthentication not enforced");
    const guest = await request("POST", `/api/admin/users/${target.id}/password-view`, {}, false);
    if (![401, 403].includes(guest.status)) throw new Error("Guest lookup was not denied");
    console.log("Operating administrator UI, no-original lookup, no-store and access denial verified.");
  }
} catch (error) {
  // SQL/HTTP errors may contain secrets: never serialize them.
  console.error("Password release verification failed; inspect privately without resetting operating data.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/admin/logout").catch(() => {});
  await pool.end();
}
