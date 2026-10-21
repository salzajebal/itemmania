import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { createSessionRouter, SESSION_MAX_AGE } from "./session-routing";

test("administrator and member cookies, stores, logout and devices remain independent", async () => {
  const members = new session.MemoryStore(), admins = new session.MemoryStore();
  const app = express();
  app.use(createSessionRouter(members, admins, "synthetic-test-only-secret", false));
  app.get("/api/admin/login-test", (req, res) => {
    req.session.adminId = 1; req.session.adminRole = "admin";
    res.json({ ok: true });
  });
  app.get("/member/login-test", (req, res) => {
    req.session.userId = 2; req.session.userRole = "user";
    res.json({ ok: true });
  });
  app.get(["/api/admin/me", "/member/me"], (req, res) => {
    const allowed = req.path.startsWith("/api/admin/") ? !!req.session.adminId : !!req.session.userId;
    res.status(allowed ? 200 : 401).json({ adminId: req.session.adminId, userId: req.session.userId,
      maxAge: req.session.cookie.originalMaxAge });
  });
  app.get(["/api/admin/logout-test", "/member/logout-test"], (req, res) => {
    req.session.destroy(error => { if (error) res.sendStatus(500); else res.json({ ok: true }); });
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const jar = new Map<string, string>(), device2 = new Map<string, string>();
  async function request(path: string, cookies = jar) {
    const response = await fetch(base + path, { headers: {
      Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    } });
    const names = [];
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(";")[0], index = pair.indexOf("=");
      const name = pair.slice(0, index);
      names.push(name); cookies.set(name, pair.slice(index + 1));
      assert.match(value, /HttpOnly/); assert.match(value, /SameSite=Lax/);
    }
    return { status: response.status,
      body: await response.json() as { adminId?: number; userId?: number; maxAge?: number }, names };
  }
  try {
    assert.deepEqual((await request("/api/admin/login-test")).names, ["admin.sid"]);
    const firstAdminCookie = jar.get("admin.sid");
    assert.deepEqual((await request("/member/login-test")).names, ["connect.sid"]);
    assert.equal(jar.get("admin.sid"), firstAdminCookie);
    assert.notEqual(jar.get("connect.sid"), firstAdminCookie);
    const admin = await request("/api/admin/me");
    assert.equal(admin.status, 200); assert.equal(admin.body.adminId, 1);
    assert.equal(admin.body.userId, undefined);
    assert.equal(admin.body.maxAge, SESSION_MAX_AGE);
    assert.equal((await request("/member/me")).body.userId, 2);
    await request("/api/admin/login-test", device2);
    assert.notEqual(device2.get("admin.sid"), firstAdminCookie);
    await request("/member/logout-test");
    assert.equal((await request("/member/me")).status, 401);
    assert.equal((await request("/api/admin/me")).status, 200);
    await request("/member/login-test");
    await request("/api/admin/logout-test");
    assert.equal((await request("/api/admin/me")).status, 401);
    assert.equal((await request("/member/me")).status, 200);
    assert.equal((await request("/api/admin/me", device2)).status, 200);
    // Even legacy cookies sharing a signed SID cannot cross separate stores.
    const legacyJar = new Map([["connect.sid", device2.get("admin.sid")!],
      ["admin.sid", device2.get("admin.sid")!]]);
    assert.equal((await request("/member/me", legacyJar)).status, 401);
    assert.equal((await request("/api/admin/me", legacyJar)).status, 200);
    await request("/member/logout-test", legacyJar);
    assert.equal((await request("/api/admin/me", device2)).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
