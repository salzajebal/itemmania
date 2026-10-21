import https from "node:https";
import { Script } from "node:vm";
import { createRequire } from "node:module";
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let cookie;
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "127.0.0.1", servername: "ltemmania.com", port: 443, path, method,
      headers: {
        Host: "ltemmania.com", "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode, text: Buffer.concat(chunks).toString(),
        cookie: res.headers["set-cookie"]?.map(v => v.split(";")[0]).join("; "),
      }));
    });
    req.setTimeout(15000, () => req.destroy(new Error("Timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
try {
  const [admin] = (await pool.query("SELECT email FROM users WHERE role='admin' AND deleted_at IS NULL AND suspended_at IS NULL ORDER BY id LIMIT 1")).rows;
  const login = await request("POST", "/api/auth/login", { email: admin.email, password: process.env.ADMIN_PASSWORD });
  if (login.status !== 200 || !login.cookie?.includes("connect.sid=")) throw new Error("Login failed");
  cookie = login.cookie;
  // Nonexistent room: inspect served JS, never load a real conversation or post.
  const page = await request("GET", "/myroom/chat/new_chat.html?roomId=0");
  const scripts = [...page.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const composer = scripts.find(script => script.includes("function setupTradeChatComposer("));
  if (page.status !== 200 || !composer) throw new Error("Composer not served");
  new Script(composer);
  for (const marker of ["pendingCompositionSend", "suppressHeldEnter", "textarea.value === draft", "sendingMessage = true", "initialComposer.focus()"]) {
    if (!composer.includes(marker)) throw new Error("Release marker missing");
  }
  if (composer.includes("justComposed")) throw new Error("Old double-Enter guard remains");
  if (composer.indexOf("roomEl.style.visibility = 'visible'") > composer.indexOf("initialComposer.focus()")) {
    throw new Error("Focus precedes visibility");
  }
  console.log("Operating chat HTML serves parse-valid single-Enter composer, visible-room focus, and draft-preserving send.");
} catch {
  // Do not serialize connection errors, response bodies or cookies.
  console.error("Operating chat acceptance failed. No messages or trade records were created.");
  process.exitCode = 1;
} finally {
  if (cookie) await request("POST", "/api/auth/logout").catch(() => {});
  await pool.end();
}
