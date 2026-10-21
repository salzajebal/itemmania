import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Run only against the external VPS, through systemd's EnvironmentFile handling.
// Never source /etc/itemmania.env as a shell script or print its values.
const mode = process.argv[2];
if (!["check", "apply", "flags", "backup"].includes(mode)) throw new Error("Invalid setup mode");
if (!process.env.APP_ROOT) throw new Error("VPS application root is missing.");
const properties = [
  "EnvironmentFiles", "Environment", "UnsetEnvironment", "PassEnvironment",
  "ExecStart", "ExecCondition", "ExecStartPre", "ExecStartPost", "ExecStop", "ExecStopPost",
  "BindPaths", "BindReadOnlyPaths", "TemporaryFileSystem",
  "WorkingDirectory", "RootDirectory", "RootImage", "MainPID", "Type", "NeedDaemonReload"
];
const unitText = execFileSync("systemctl", ["show", "itemmania", ...properties.map(key => `--property=${key}`)], { encoding: "utf8" });
const unit = Object.fromEntries(unitText.trim().split("\n").map(line => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const unsupported = ["UnsetEnvironment", "PassEnvironment", "ExecCondition", "ExecStartPre", "ExecStartPost", "ExecStop", "ExecStopPost", "RootDirectory", "RootImage", "BindPaths", "BindReadOnlyPaths", "TemporaryFileSystem"];
if (unsupported.some(key => unit[key]) || unit.NeedDaemonReload === "yes" ||
    !["simple", "exec"].includes(unit.Type) ||
    !/^\/etc\/itemmania\.env(?:\s+\(ignore_errors=(?:yes|no)\))?\s*$/.test(unit.EnvironmentFiles ?? "")) {
  throw new Error("Unsupported service configuration. No deployment or settings changes performed.");
}
const apiRoot = path.join(process.env.APP_ROOT, "artifacts/api-server");
if (![process.env.APP_ROOT, apiRoot].includes(unit.WorkingDirectory)) {
  throw new Error("Unexpected service working directory.");
}
const start = unit.ExecStart?.match(/path=([^;]+);\s*argv\[\]=([^;]+);\s*ignore_errors=/);
if (!start) throw new Error("Cannot verify direct Node service execution.");
const argv = start[2].trim().split(/\s+/);
const { realpath } = await import("node:fs/promises");
if (await realpath(start[1].trim()) !== await realpath(process.execPath) ||
    argv[0] !== start[1].trim()) {
  throw new Error("The service must execute Node directly, without a shell or rebuild.");
}
const args = argv.slice(1);
if (args[0] === "--enable-source-maps") args.shift();
if (args.length !== 1 || path.resolve(unit.WorkingDirectory, args[0]) !== path.join(apiRoot, "dist/index.mjs")) {
  throw new Error("The service does not execute the expected compiled entry.");
}
// EnvironmentFile values override unit Environment values. Include the latter
// when a protection is configured in the service unit rather than the file.
const unitProtections = new Map();
for (const token of (unit.Environment ?? "").trim().split(/\s+/).filter(Boolean)) {
  const match = token.match(/^"?(NODE_ENV|ALLOW_STARTUP_DB_SYNC|BIND_HOST|PORT)=([A-Za-z0-9_.:-]*)"?$/);
  if (!match) throw new Error("Unsupported unit environment; keep credentials in the existing EnvironmentFile.");
  unitProtections.set(match[1], match[2]);
}
if (mode === "flags") {
  // Only validated non-secret flags are returned to the installer. Mirroring
  // these into the transient unit reproduces systemd's actual precedence:
  // manager defaults < unit Environment < EnvironmentFile.
  console.log([...unitProtections].map(([key, value]) => `${key}=${value}`).join("\n"));
  process.exit(0);
}
const effective = key => process.env[key] ?? unitProtections.get(key);
if (effective("NODE_ENV") !== "production" ||
    effective("ALLOW_STARTUP_DB_SYNC") === "1" ||
    !["127.0.0.1", "::1", "localhost"].includes(effective("BIND_HOST"))) {
  throw new Error("Production/loopback/startup-sync protections are not satisfied; no settings were changed.");
}
if (!process.env.DATABASE_URL || !process.env.APP_ROOT) {
  throw new Error("Required VPS environment settings are missing.");
}
if (!/^[1-9]\d*$/.test(unit.MainPID ?? "")) throw new Error("The service has no running main process.");
const liveText = await readFile(`/proc/${unit.MainPID}/environ`, "utf8");
const live = Object.fromEntries(liveText.split("\0").filter(Boolean).map(value => {
  const separator = value.indexOf("=");
  return [value.slice(0, separator), value.slice(separator + 1)];
}));
if (live.DATABASE_URL !== process.env.DATABASE_URL ||
    ["NODE_ENV", "BIND_HOST", "ALLOW_STARTUP_DB_SYNC"].some(key => live[key] !== effective(key))) {
  throw new Error("Service configuration differs from its running database/protections. No deployment performed.");
}

const require = createRequire(path.join(process.env.APP_ROOT, "lib/db/package.json"));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  const { rows: [tables] } = await pool.query(
    "SELECT to_regclass('public.users') AS users, to_regclass('public.wallets') AS wallets, " +
    "to_regclass('public.orders') AS orders, to_regclass('public.chat_rooms') AS chats"
  );
  if (Object.values(tables).some(value => value === null)) {
    throw new Error("The configured database does not have the expected Itemmania tables.");
  }
  if (mode === "backup") {
    const { backupOperatingRelease } = await import("./vps-release-backup.mjs");
    await backupOperatingRelease({ pool, appRoot: process.env.APP_ROOT });
  }
  if (mode === "apply") {
    const ddl = await readFile(process.env.REGISTRATION_DDL, "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(ddl);
      await client.query("SELECT key, blocked, updated_at FROM registration_settings LIMIT 0");
      if (process.env.TRADE_CHARACTER_DDL) {
        await client.query(await readFile(process.env.TRADE_CHARACTER_DDL, "utf8"));
        await client.query("SELECT buyer_character_name, seller_character_name, buyer_dismissed_at, seller_dismissed_at FROM chat_rooms LIMIT 0");
        await client.query("SELECT admin_deleted_at, admin_deleted_by, admin_hidden_at, admin_hidden_by FROM orders LIMIT 0");
        await client.query("SELECT admin_deleted_at, admin_deleted_by FROM chat_rooms LIMIT 0");
      }
      if (process.env.ADMIN_SESSION_DDL) {
        await client.query(await readFile(process.env.ADMIN_SESSION_DDL, "utf8"));
        await client.query("SELECT sid, sess, expire FROM admin_sessions LIMIT 0");
      }
      if (process.env.MEMBER_REMOVAL_DDL) {
        await client.query(await readFile(process.env.MEMBER_REMOVAL_DDL, "utf8"));
        await client.query("SELECT deleted_at, deleted_by FROM users LIMIT 0");
      }
      if (process.env.SUPPORT_CHAT_DDL) {
        await client.query(await readFile(process.env.SUPPORT_CHAT_DDL, "utf8"));
        await client.query("SELECT user_id,last_message_id,member_read_id,admin_read_id FROM support_conversations LIMIT 0");
        await client.query("SELECT id,user_id,sender,sender_id,body,client_id FROM support_messages LIMIT 0");
      }
      if (process.env.PRODUCT_VIEWS_DDL) {
        await client.query(await readFile(process.env.PRODUCT_VIEWS_DDL, "utf8"));
        await client.query("SELECT view_count FROM products LIMIT 0");
      }
      if (process.env.REGISTERED_CHARACTER_PRIVACY_DDL) {
        await client.query(await readFile(process.env.REGISTERED_CHARACTER_PRIVACY_DDL, "utf8"));
        await client.query("SELECT registered_character_name,character_name_in_description FROM products LIMIT 0");
      }
      if (process.env.MEMBER_PASSWORD_ORIGINALS_DDL) {
        await client.query(await readFile(process.env.MEMBER_PASSWORD_ORIGINALS_DDL, "utf8"));
        await client.query("SELECT user_id,password,updated_at FROM member_password_originals LIMIT 0");
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(mode === "apply" ? "Authorized additive schema ready; existing rows preserved." : "VPS environment and database checks passed.");
} catch {
  // Avoid exposing credentials through connection errors or environment output.
  console.error("VPS database check/setup failed. No member or trade rows were modified.");
  process.exitCode = 1;
} finally {
  await pool.end();
}