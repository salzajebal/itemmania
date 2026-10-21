// Isolated development regression test for the registration policy.
//
// The script derives the dedicated member_trade_test database from DATABASE_URL
// by changing only its pathname, and applies policy/private-auth prerequisites there.
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Registration policy tests are development-only.");
}

import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, "..");
const projectDir = path.resolve(apiDir, "../..");
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to derive the dedicated member_trade_test database URL.");
}

const appDatabaseUrl = new URL(process.env.DATABASE_URL);
const databaseUrl = new URL(appDatabaseUrl);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL must be a PostgreSQL URL.");
}
databaseUrl.pathname = "/member_trade_test";
const testDatabaseUrl = databaseUrl.toString();
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
if (appDatabaseUrl.pathname === databaseUrl.pathname) {
  throw new Error("The isolated test database must not be the normal DATABASE_URL target.");
}

// Resolve pg from the DB workspace dependency without adding script dependencies.
const requireFromDbWorkspace = createRequire(path.join(projectDir, "lib/db/package.json"));
const { Pool } = requireFromDbWorkspace("pg");
const testDb = new Pool({ connectionString: testDatabaseUrl, max: 3, connectionTimeoutMillis: 5000 });

const suffix = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
const sessionSecret = `registration-policy-test-${suffix}`;
const adminPassword = `registration-policy-admin-${suffix}`;
const fixtureEmails = new Map();
const fixtureUserIds = new Set();
let serverProcess;
let serverOutput = "";
let origin;
let apiBase;
let renamedPolicyTable;
const renamedTableName = `registration_settings_test_hold_${suffix.replace(/-/g, "_")}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, label) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function recordServerOutput(chunk) {
  // Retain bounded diagnostics for startup failures; never print environment values.
  serverOutput = (serverOutput + chunk.toString()).slice(-12000);
}

async function findFreePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  assert(address && typeof address !== "string", "Could not reserve a local test port.");
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function verifyTestDatabaseAndEnsurePolicyTable() {
  const { rows } = await testDb.query(
    `SELECT current_database() AS database_name, current_schema() AS schema_name,
            json_agg(table_name) AS tables
       FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      GROUP BY current_database(), current_schema()`,
    [["users", "wallets"]],
  );
  equal(rows[0]?.database_name, databaseName, "Connected test database");
  const present = new Set(rows[0]?.tables ?? []);
  const missing = ["users", "wallets"].filter(table => !present.has(table));
  assert(
    missing.length === 0,
    `Dedicated test database is missing schema tables: ${missing.join(", ")}. Apply the DB schema to this test database first.`,
  );

  // The persistent test DB can predate private admin sessions/password retention.
  // These empty prerequisite tables are created only in member_trade_test.
  await testDb.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS admin_sessions_expire_idx ON admin_sessions (expire);
    CREATE TABLE IF NOT EXISTS member_password_originals (
      user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      password text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS registration_settings (
      key text PRIMARY KEY,
      blocked boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows: columns } = await testDb.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'registration_settings'`,
  );
  const actualColumns = new Map(columns.map(column => [column.column_name, column.data_type]));
  equal(actualColumns.get("key"), "text", "registration_settings.key type");
  equal(actualColumns.get("blocked"), "boolean", "registration_settings.blocked type");
  equal(actualColumns.get("updated_at"), "timestamp with time zone", "registration_settings.updated_at type");
}

async function startIsolatedServer() {
  const port = await findFreePort();
  const tsxCli = path.join(apiDir, "node_modules/tsx/dist/cli.mjs");
  serverProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: testDatabaseUrl,
      PORT: String(port),
      BIND_HOST: "127.0.0.1",
      SESSION_SECRET: sessionSecret,
      ADMIN_PASSWORD: adminPassword,
      AUTO_CRAWL_ENABLED: "0",
      ALLOW_STARTUP_DB_SYNC: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", recordServerOutput);
  serverProcess.stderr.on("data", recordServerOutput);

  origin = `http://127.0.0.1:${port}`;
  apiBase = `${origin}/api`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Isolated API server exited before startup.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${apiBase}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The child is still starting; retry until the bounded deadline.
    }
    await delay(200);
  }
  throw new Error(`Timed out starting the isolated API server.\n${serverOutput}`);
}

async function stopIsolatedServer() {
  if (!serverProcess) return;
  if (serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => serverProcess.once("exit", resolve)),
      delay(5000),
    ]);
    if (serverProcess.exitCode === null) serverProcess.kill("SIGKILL");
  }
  serverProcess = undefined;
}

function extractCookie(response) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  const cookieName = setCookies.some(value => value.includes("admin.sid=")) ? "admin.sid" : "connect.sid";
  const header = setCookies.find(value => value.includes(`${cookieName}=`)) ?? "";
  const match = header.match(new RegExp(`(?:^|[,;]\\s*)${cookieName}=([^;]*)`));
  return match ? `${cookieName}=${match[1]}` : undefined;
}

async function sendRequest(url, {
  method = "GET",
  body,
  cookie = "",
  headers = {},
} = {}) {
  const requestHeaders = { ...headers };
  let requestBody = body;
  if (body !== undefined && !(body instanceof URLSearchParams) && typeof body !== "string") {
    requestHeaders["Content-Type"] ??= "application/json";
    requestBody = JSON.stringify(body);
  }
  if (cookie) requestHeaders.Cookie = cookie;

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
    redirect: "manual",
  });
  const text = await response.text();
  let value = text;
  try {
    value = JSON.parse(text);
  } catch {
    // Legacy login responses are HTML/redirects, while API responses are JSON.
  }
  return {
    status: response.status,
    value,
    text,
    cookie: extractCookie(response),
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type") ?? "",
  };
}

function apiRequest(pathname, options) {
  return sendRequest(`${apiBase}${pathname}`, options);
}

function legacyRequest(pathname, options) {
  return sendRequest(`${origin}${pathname}`, options);
}

function expectStatus(result, expected, label) {
  equal(result.status, expected, label);
  return result.value;
}

function registrationPayload(name) {
  const email = `rp-${suffix}-${name}@example.invalid`;
  const password = "registration-fixture-password";
  fixtureEmails.set(name, email);
  return { email, password, nickname: `rp${name}${suffix}`.slice(0, 30) };
}

async function fixtureAccountId(email) {
  const { rows } = await testDb.query("SELECT id FROM users WHERE email = $1", [email]);
  assert(rows.length === 1, `Expected isolated fixture account ${email} to exist.`);
  const id = Number(rows[0].id);
  fixtureUserIds.add(id);
  return id;
}

async function assertFixtureWallet(email, label) {
  const userId = await fixtureAccountId(email);
  const member = await testDb.query("SELECT grade FROM users WHERE id = $1", [userId]);
  equal(member.rows[0].grade, "gold", `${label} new member starts at gold`);
  const { rows } = await testDb.query("SELECT balance FROM wallets WHERE user_id = $1", [userId]);
  equal(rows.length, 1, `${label} creates one wallet`);
  equal(Number(rows[0].balance), 0, `${label} wallet starts at zero`);
}

async function accountCounts() {
  const { rows } = await testDb.query(`
    SELECT (SELECT count(*)::int FROM users) AS users,
           (SELECT count(*)::int FROM wallets) AS wallets
  `);
  return { users: rows[0].users, wallets: rows[0].wallets };
}

function assertCountsEqual(actual, expected, label) {
  equal(actual.users, expected.users, `${label} user count`);
  equal(actual.wallets, expected.wallets, `${label} wallet count`);
}

async function setPolicy(cookie, blocked) {
  const response = await apiRequest("/admin/registration-policy", {
    method: "PATCH",
    cookie,
    body: { blocked },
  });
  equal(response.status, 200, `set registration policy ${blocked}`);
  equal(response.value.blocked, blocked, `persist registration policy ${blocked}`);
}

async function getAdminPolicy(cookie, expected) {
  const response = await apiRequest("/admin/registration-policy", { cookie });
  equal(response.status, 200, "read registration policy");
  equal(response.value.blocked, expected, "registration policy value");
}

async function registerViaApi(name) {
  const payload = registrationPayload(name);
  const response = await apiRequest("/auth/register", { method: "POST", body: payload });
  const account = expectStatus(response, 201, `register ${name} through API`);
  assert(Number.isSafeInteger(account.id), `API registration did not return an ID for ${name}.`);
  fixtureUserIds.add(account.id);
  assert(response.cookie?.startsWith("connect.sid="), `API registration did not issue a member session for ${name}.`);
  await assertFixtureWallet(payload.email, `API registration ${name}`);
  return { ...payload, id: account.id, cookie: response.cookie };
}

async function autoLoginViaApi(name) {
  const payload = registrationPayload(name);
  const response = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: payload.email, password: payload.password },
  });
  const account = expectStatus(response, 200, `auto-create ${name} through API login`);
  assert(Number.isSafeInteger(account.id), `API auto-login did not return an ID for ${name}.`);
  fixtureUserIds.add(account.id);
  assert(response.cookie?.startsWith("connect.sid="), `API auto-login did not issue a member session for ${name}.`);
  await assertFixtureWallet(payload.email, `API auto-login ${name}`);
  return { ...payload, id: account.id, cookie: response.cookie };
}

async function autoLoginLegacy(name, method) {
  const payload = registrationPayload(name);
  const form = new URLSearchParams({ user_id: payload.email, user_password: payload.password });
  const endpoint = "/portal/user/login_form_ok.php";
  const response = method === "GET"
    ? await legacyRequest(`${endpoint}?${form.toString()}`)
    : await legacyRequest(endpoint, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  equal(response.status, 302, `legacy ${method} login auto-creates ${name}`);
  assert(response.location?.startsWith("/"), `legacy ${method} login did not redirect locally for ${name}.`);
  await assertFixtureWallet(payload.email, `legacy ${method} login ${name}`);
  return { ...payload, id: await fixtureAccountId(payload.email), cookie: response.cookie };
}

async function submitUnknownApiLogin(name) {
  const payload = registrationPayload(name);
  return apiRequest("/auth/login", {
    method: "POST",
    body: { email: payload.email, password: payload.password },
  });
}

async function submitUnknownLegacyLogin(name, method) {
  const payload = registrationPayload(name);
  const form = new URLSearchParams({ user_id: payload.email, user_password: payload.password });
  const endpoint = "/portal/user/login_form_ok.php";
  if (method === "GET") return legacyRequest(`${endpoint}?${form.toString()}`);
  return legacyRequest(endpoint, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

async function baselineWalletBalances() {
  const { rows } = await testDb.query("SELECT user_id, balance::text AS balance FROM wallets ORDER BY user_id");
  return new Map(rows.map(row => [Number(row.user_id), row.balance]));
}

async function assertBaselineWalletsUnchanged(baseline) {
  const { rows } = await testDb.query("SELECT user_id, balance::text AS balance FROM wallets ORDER BY user_id");
  const current = new Map(rows.map(row => [Number(row.user_id), row.balance]));
  for (const [userId, balance] of baseline) {
    equal(current.get(userId), balance, `pre-existing isolated wallet ${userId} balance`);
  }
}

async function restorePolicyTable() {
  if (!renamedPolicyTable) return;
  await testDb.query(`ALTER TABLE "${renamedTableName}" RENAME TO registration_settings`);
  renamedPolicyTable = false;
}

async function restorePolicyOff() {
  await testDb.query(
    `INSERT INTO registration_settings (key, blocked)
     VALUES ('new_members', false)
     ON CONFLICT (key) DO UPDATE SET blocked = false, updated_at = now()`,
  );
}

async function cleanupFixtureAccounts() {
  if (fixtureUserIds.size === 0) return;
  const ids = [...fixtureUserIds];
  await testDb.query("DELETE FROM wallets WHERE user_id = ANY($1::int[])", [ids]);
  await testDb.query("DELETE FROM users WHERE id = ANY($1::int[])", [ids]);
}

async function runRegressionTests() {
  // Remove only this policy key from the dedicated test DB so the initial
  // absent-row behavior can be asserted independently of prior test runs.
  await testDb.query("DELETE FROM registration_settings WHERE key = 'new_members'");
  await startIsolatedServer();
  const originalWalletBalances = await baselineWalletBalances();

  const unauthGet = await apiRequest("/admin/registration-policy");
  assert([401, 403].includes(unauthGet.status), "Unauthenticated policy GET was not denied.");
  const unauthPatch = await apiRequest("/admin/registration-policy", {
    method: "PATCH",
    body: { blocked: true },
  });
  assert([401, 403].includes(unauthPatch.status), "Unauthenticated policy PATCH was not denied.");

  const adminLogin = await apiRequest("/admin/login", {
    method: "POST",
    body: { email: "admin", password: adminPassword },
  });
  expectStatus(adminLogin, 200, "login seeded test-only administrator");
  assert(adminLogin.cookie?.startsWith("admin.sid="), "Admin login did not issue the isolated admin session.");
  let adminCookie = adminLogin.cookie;

  await getAdminPolicy(adminCookie, false);

  const apiSignup = await registerViaApi("api-off");
  const memberGet = await apiRequest("/admin/registration-policy", { cookie: apiSignup.cookie });
  assert([401, 403].includes(memberGet.status), "Member session was not denied policy GET.");
  const memberPatch = await apiRequest("/admin/registration-policy", {
    method: "PATCH",
    cookie: apiSignup.cookie,
    body: { blocked: true },
  });
  assert([401, 403].includes(memberPatch.status), "Member session was not denied policy PATCH.");

  const crawlKey = createHmac("sha256", sessionSecret).update("crawl-key-v1").digest("hex").slice(0, 32);
  const crawlKeyPolicy = await apiRequest("/admin/registration-policy", {
    headers: { "x-crawl-key": crawlKey },
  });
  assert([401, 403].includes(crawlKeyPolicy.status), "Crawl key incorrectly authorized policy access.");

  const malformed = await apiRequest("/admin/registration-policy", {
    method: "PATCH",
    cookie: adminCookie,
    body: { blocked: "true" },
  });
  equal(malformed.status, 400, "malformed blocked value is rejected");

  const autoApiOff = await autoLoginViaApi("api-auto-off");
  const legacyGetOff = await autoLoginLegacy("legacy-get-off", "GET");
  const legacyPostOff = await autoLoginLegacy("legacy-post-off", "POST");
  await assertFixtureWallet(autoApiOff.email, "OFF API auto-login");
  await assertFixtureWallet(legacyGetOff.email, "OFF legacy GET");
  await assertFixtureWallet(legacyPostOff.email, "OFF legacy POST");

  // Race an ON update against a real account creation. Either the member
  // transaction gets the shared advisory lock first, or the ON update does;
  // once the update acknowledges, no later creation may slip through.
  const beforeRaceCounts = await accountCounts();
  const racePayload = registrationPayload("admin-on-race");
  const [racePolicy, raceRegistration] = await Promise.all([
    apiRequest("/admin/registration-policy", {
      method: "PATCH",
      cookie: adminCookie,
      body: { blocked: true },
    }),
    apiRequest("/auth/register", { method: "POST", body: racePayload }),
  ]);
  equal(racePolicy.status, 200, "concurrent ON policy update");
  equal(racePolicy.value.blocked, true, "concurrent ON policy persisted");
  assert(
    raceRegistration.status === 201 || raceRegistration.status === 403,
    `Concurrent registration returned unexpected status ${raceRegistration.status}.`,
  );
  if (raceRegistration.status === 201) {
    assert(Number.isSafeInteger(raceRegistration.value.id), "Concurrent signup omitted its account ID.");
    fixtureUserIds.add(raceRegistration.value.id);
    assert(
      raceRegistration.cookie?.startsWith("connect.sid="),
      "Successful concurrent registration did not issue a member session.",
    );
    await assertFixtureWallet(racePayload.email, "registration racing the ON update");
  } else {
    equal(raceRegistration.value.code, "REGISTRATION_DISABLED", "raced registration block code");
  }
  await getAdminPolicy(adminCookie, true);
  const raceCounts = await accountCounts();
  const expectedRaceCreates = raceRegistration.status === 201 ? 1 : 0;
  equal(raceCounts.users - beforeRaceCounts.users, expectedRaceCreates, "raced account user count");
  equal(raceCounts.wallets - beforeRaceCounts.wallets, expectedRaceCreates, "raced account wallet count");

  const onRequestCounts = await accountCounts();
  const blockedRegisterPayload = registrationPayload("blocked-register");
  const blockedRegister = await apiRequest("/auth/register", {
    method: "POST",
    body: blockedRegisterPayload,
  });
  equal(blockedRegister.status, 403, "blocked API registration status");
  equal(blockedRegister.value.code, "REGISTRATION_DISABLED", "blocked API registration code");

  const blockedApiLogin = await submitUnknownApiLogin("blocked-api-login");
  equal(blockedApiLogin.status, 403, "blocked API auto-login status");
  equal(blockedApiLogin.value.code, "REGISTRATION_DISABLED", "blocked API auto-login code");

  const blockedLegacyGet = await submitUnknownLegacyLogin("blocked-legacy-get", "GET");
  equal(blockedLegacyGet.status, 403, "blocked legacy GET status");
  assert(blockedLegacyGet.contentType.includes("text/html"), "Blocked legacy GET did not return HTML.");
  assert(blockedLegacyGet.text.includes("현재 신규 가입이 중단되었습니다."), "Blocked legacy GET omitted its explanatory message.");

  const blockedLegacyPost = await submitUnknownLegacyLogin("blocked-legacy-post", "POST");
  equal(blockedLegacyPost.status, 403, "blocked legacy POST status");
  assert(blockedLegacyPost.contentType.includes("text/html"), "Blocked legacy POST did not return HTML.");
  assert(blockedLegacyPost.text.includes("현재 신규 가입이 중단되었습니다."), "Blocked legacy POST omitted its explanatory message.");
  assertCountsEqual(await accountCounts(), onRequestCounts, "blocked API and legacy requests");

  // Existing grades are owned by the member/admin history, not the new default.
  await testDb.query("UPDATE users SET grade='bronze' WHERE id=$1", [apiSignup.id]);
  const validApiLogin = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: apiSignup.email, password: apiSignup.password },
  });
  expectStatus(validApiLogin, 200, "existing API member login while blocked");
  const wrongApiPassword = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: apiSignup.email, password: "wrong-registration-password" },
  });
  equal(wrongApiPassword.status, 401, "wrong API password remains an authentication failure while blocked");
  assert(wrongApiPassword.value.code !== "REGISTRATION_DISABLED", "Wrong API password was reported as registration-disabled.");

  const legacyGetExisting = new URLSearchParams({
    user_id: apiSignup.email,
    user_password: apiSignup.password,
  });
  const allowedLegacyGet = await legacyRequest(`/portal/user/login_form_ok.php?${legacyGetExisting.toString()}`);
  equal(allowedLegacyGet.status, 302, "existing legacy GET login while blocked");
  assert(allowedLegacyGet.location?.startsWith("/"), "Existing legacy GET login did not redirect locally.");
  equal((await testDb.query("SELECT grade FROM users WHERE id=$1", [apiSignup.id])).rows[0].grade,
    "bronze", "API and legacy login preserve existing member grade");

  const legacyPostExisting = new URLSearchParams({
    user_id: apiSignup.email,
    user_password: apiSignup.password,
  });
  const allowedLegacyPost = await legacyRequest("/portal/user/login_form_ok.php", {
    method: "POST",
    body: legacyPostExisting,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  equal(allowedLegacyPost.status, 302, "existing legacy POST login while blocked");
  assert(allowedLegacyPost.location?.startsWith("/"), "Existing legacy POST login did not redirect locally.");

  const wrongLegacyPassword = new URLSearchParams({
    user_id: apiSignup.email,
    user_password: "wrong-registration-password",
  });
  const wrongLegacy = await legacyRequest(`/portal/user/login_form_ok.php?${wrongLegacyPassword.toString()}`);
  equal(wrongLegacy.status, 302, "wrong legacy password remains a normal redirect while blocked");
  assert(wrongLegacy.location?.includes("error=wrong_password"), "Wrong legacy password did not retain the normal error.");
  assertCountsEqual(await accountCounts(), onRequestCounts, "existing member logins while blocked");

  await stopIsolatedServer();
  await startIsolatedServer();
  const restartedAdminLogin = await apiRequest("/admin/login", {
    method: "POST",
    body: { email: "admin", password: adminPassword },
  });
  expectStatus(restartedAdminLogin, 200, "re-login administrator after isolated process restart");
  assert(restartedAdminLogin.cookie?.startsWith("admin.sid="), "Restarted server did not issue admin session.");
  adminCookie = restartedAdminLogin.cookie;
  await getAdminPolicy(adminCookie, true);
  const stillBlockedAfterRestart = await submitUnknownApiLogin("blocked-after-restart");
  equal(stillBlockedAfterRestart.status, 403, "persisted policy blocks API auto-login after restart");
  equal(stillBlockedAfterRestart.value.code, "REGISTRATION_DISABLED", "restart block uses registration error code");

  await setPolicy(adminCookie, false);
  const restoredApiSignup = await registerViaApi("api-off-restored");
  const restoredApiAutoLogin = await autoLoginViaApi("api-auto-off-restored");
  const restoredLegacyGet = await autoLoginLegacy("legacy-get-off-restored", "GET");
  const restoredLegacyPost = await autoLoginLegacy("legacy-post-off-restored", "POST");
  await assertFixtureWallet(restoredApiSignup.email, "restored OFF API registration");
  await assertFixtureWallet(restoredApiAutoLogin.email, "restored OFF API auto-login");
  await assertFixtureWallet(restoredLegacyGet.email, "restored OFF legacy GET");
  await assertFixtureWallet(restoredLegacyPost.email, "restored OFF legacy POST");
  await getAdminPolicy(adminCookie, false);

  // Missing-table behavior is verified only against this isolated database.
  // The table is renamed (not dropped) and restored in the outer finally block.
  const beforeMissingTableRequests = await accountCounts();
  await testDb.query(`ALTER TABLE registration_settings RENAME TO "${renamedTableName}"`);
  renamedPolicyTable = true;
  const unavailablePolicy = await apiRequest("/admin/registration-policy", { cookie: adminCookie });
  equal(unavailablePolicy.status, 503, "missing policy table fails closed for admin read");
  const unavailableRegister = await apiRequest("/auth/register", {
    method: "POST",
    body: registrationPayload("missing-table-register"),
  });
  equal(unavailableRegister.status, 503, "missing policy table fails closed for registration");
  const unavailableApiAutoLogin = await submitUnknownApiLogin("missing-table-api-login");
  equal(unavailableApiAutoLogin.status, 503, "missing policy table fails closed for API auto-login");
  const unavailableLegacyGet = await submitUnknownLegacyLogin("missing-table-legacy-get", "GET");
  equal(unavailableLegacyGet.status, 302, "missing policy table does not create a legacy GET account");
  const unavailableLegacyPost = await submitUnknownLegacyLogin("missing-table-legacy-post", "POST");
  equal(unavailableLegacyPost.status, 302, "missing policy table does not create a legacy POST account");
  assertCountsEqual(await accountCounts(), beforeMissingTableRequests, "requests with a missing policy table");
  await restorePolicyTable();
  await restorePolicyOff();

  await assertBaselineWalletsUnchanged(originalWalletBalances);
  console.log("ALL ISOLATED REGISTRATION POLICY REGRESSION CHECKS PASSED");
}

try {
  await verifyTestDatabaseAndEnsurePolicyTable();
  await runRegressionTests();
} finally {
  await stopIsolatedServer();
  try {
    await restorePolicyTable();
    await restorePolicyOff();
    await cleanupFixtureAccounts();
  } finally {
    await testDb.end();
  }
}