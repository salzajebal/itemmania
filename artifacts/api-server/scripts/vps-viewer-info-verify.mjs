import https from "node:https";
import { Script } from "node:vm";
import { createRequire } from "node:module";

// Only inspect guest and the verifier's own account. Do not print profile data.
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let cookie;
function request(method, path, body, authenticated = true) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "127.0.0.1", servername: "ltemmania.com", port: 443,
      method, path, headers: {
        Host: "ltemmania.com", "Content-Type": "application/json",
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
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
    req.setTimeout(15000, () => req.destroy(new Error("Timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
function decode(text) {
  return text.replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&");
}
function panel(html) {
  const name = html.match(/<span\b[^>]*data-im-viewer-name[^>]*>([^<]*)<\/span>/);
  const phone = html.match(/<span\b[^>]*id=["']?spnUserCell["']?[^>]*>([^<]*)<\/span>/);
  if (!name || !phone) throw new Error("Viewer panel missing");
  return { name: decode(name[1]), phone: decode(phone[1]) };
}
try {
  for (const side of ["buy", "sell"]) {
    const missing = await request("GET", `/${side}/application.html?id=2147483647&pc=1`, null, false);
    if (missing.status !== 200 || !missing.text.includes("물품을 찾을 수 없습니다.") ||
        missing.text.includes("my_private")) {
      throw new Error("Missing-product response contains captured listing data");
    }
  }
  // Check the reported listing and one real sell listing read-only.
  const sell = (await pool.query("SELECT id FROM products WHERE category='sell' AND status='active' ORDER BY id DESC LIMIT 1")).rows[0];
  if (!sell) throw new Error("No sell listing available");
  const paths = ["/buy/application.html?id=34659&pc=1", `/sell/application.html?id=${sell.id}&pc=1`];
  for (const path of paths) {
    const guest = await request("GET", path, null, false);
    const data = panel(guest.text);
    if (guest.status !== 200 || !guest.cache?.includes("no-store") ||
        data.name !== "로그인 후 확인" || data.phone !== "로그인 후 확인") {
      throw new Error("Guest HTML exposes personal fields");
    }
    const code = [...guest.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .map(m => m[1]).find(s => s.includes("window._IM_refreshTradeInfo=refresh"));
    if (!code || !code.includes("pagehide") || !code.includes("e.persisted")) {
      throw new Error("History privacy protection missing");
    }
    new Script(code);
  }
  const admin = (await pool.query(`SELECT email,nickname,phone FROM users WHERE role='admin'
    AND deleted_at IS NULL AND suspended_at IS NULL ORDER BY id LIMIT 1`)).rows[0];
  const login = await request("POST", "/api/auth/login", {
    email: admin.email, password: process.env.ADMIN_PASSWORD,
  }, false);
  if (login.status !== 200 || !login.cookie?.includes("connect.sid=")) {
    throw new Error("Verifier member login failed");
  }
  cookie = login.cookie;
  for (const path of paths) {
    const own = await request("GET", path);
    const data = panel(own.text);
    if (own.status !== 200 || !own.cache?.includes("no-store") ||
        data.name !== (admin.nickname || admin.email || "회원") ||
        data.phone !== (admin.phone || "등록된 연락처 없음")) {
      throw new Error("Own profile does not match viewer panel");
    }
  }
  console.log("Operating reported buy listing and sell listing: guest HTML is neutral, own member HTML matches own profile, no-store and history protections verified.");
} catch {
  console.error("Viewer-info acceptance failed. No trade, message or customer profile was changed.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/auth/logout").catch(() => {});
  await pool.end();
}
