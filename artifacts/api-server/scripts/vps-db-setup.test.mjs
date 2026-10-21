import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

// Isolated systemd/pg fixtures: never connects to a real database or VPS.
const temp = await mkdtemp(path.join(tmpdir(), "itemmania-release-test-"));
const bin = path.join(temp, "bin");
const root = path.join(temp, "app");
const log = path.join(temp, "queries.jsonl");
await mkdir(bin, { recursive: true });
await mkdir(path.join(root, "lib/db/node_modules/pg"), { recursive: true });
await writeFile(path.join(root, "lib/db/package.json"), '{"name":"fixture"}');
await writeFile(path.join(root, "lib/db/node_modules/pg/index.js"), `
const fs = require('node:fs');
class Pool {
  async query(sql) {
    fs.appendFileSync(process.env.QUERY_LOG, JSON.stringify(sql)+'\\n');
    return {rows:[{users:'users',wallets:'wallets',orders:'orders',chats:'chat_rooms'}]};
  }
  async connect(){return {query:this.query.bind(this),release(){}}}
  async end(){}
}
module.exports={Pool};
`);
await writeFile(path.join(bin, "systemctl"), '#!/usr/bin/env node\nconsole.log(process.env.UNIT_FIXTURE);\n', { mode: 0o755 });
const env = {
  ...process.env, PATH: `${bin}:${process.env.PATH}`, APP_ROOT: root,
  NODE_ENV: "production", BIND_HOST: "127.0.0.1", ALLOW_STARTUP_DB_SYNC: "0",
  DATABASE_URL: "postgres://fixture.invalid/test", QUERY_LOG: log,
  REGISTRATION_DDL: path.resolve("artifacts/api-server/scripts/vps-registration-settings.sql"),
};
const keeper = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { env, stdio: "ignore" });
const unit = {
  EnvironmentFiles: "/etc/itemmania.env (ignore_errors=no)", Environment: "",
  UnsetEnvironment: "", PassEnvironment: "", ExecStartPre: "", ExecStartPost: "",
  ExecCondition: "", ExecStop: "", ExecStopPost: "", RootDirectory: "", RootImage: "",
  BindPaths: "", BindReadOnlyPaths: "", TemporaryFileSystem: "",
  WorkingDirectory: root, MainPID: String(keeper.pid), Type: "simple", NeedDaemonReload: "no",
  ExecStart: `{ path=${process.execPath} ; argv[]=${process.execPath} ${root}/artifacts/api-server/dist/index.mjs ; ignore_errors=no ; }`,
};
let count = 0;
async function check(name, overrides = {}, mode = "check", valid = false, envChanges = {}) {
  await rm(log, { force: true });
  const text = Object.entries({ ...unit, ...overrides }).map(([key, value]) => `${key}=${value}`).join("\n");
  const result = spawnSync(process.execPath, ["artifacts/api-server/scripts/vps-db-setup.mjs", mode], {
    env: { ...env, ...envChanges, UNIT_FIXTURE: text }, encoding: "utf8",
  });
  assert.equal(result.status === 0, valid, `${name}: ${result.stderr}`);
  let queries = "";
  try { queries = await readFile(log, "utf8"); } catch {}
  if (!valid) assert.equal(queries, "", `${name}: failure must precede database access`);
  if (valid && mode === "apply") {
    const statements = queries.trim().split("\n").map(line => JSON.parse(line));
    const includesPasswordSchema = Boolean(envChanges.MEMBER_PASSWORD_ORIGINALS_DDL);
    assert.equal(statements.length, includesPasswordSchema ? 7 : 5);
    assert.equal(statements[1], "BEGIN");
    assert.match(statements[2], /CREATE TABLE IF NOT EXISTS registration_settings/);
    assert.equal(statements.at(-1), "COMMIT");
    if (includesPasswordSchema) {
      assert.match(statements[4], /CREATE TABLE IF NOT EXISTS public\.member_password_originals/);
      assert.equal(statements[5], "SELECT user_id,password,updated_at FROM member_password_originals LIMIT 0");
    }
    assert.ok(statements.every(sql => !/\b(?:INSERT|UPDATE|DELETE|DROP)\b/i.test(sql.replace(/ON DELETE CASCADE/g, ""))));
  }
  count++;
}
try {
  await check("supported configuration", {}, "check", true);
  await check("authorized additive DDL only", {}, "apply", true);
  await check("authorized member password table only", {}, "apply", true, {
    MEMBER_PASSWORD_ORIGINALS_DDL: path.resolve("artifacts/api-server/scripts/vps-member-password-originals.sql"),
  });
  await check("later environment file", { EnvironmentFiles: unit.EnvironmentFiles + " /etc/other.env (ignore_errors=no)" });
  await check("initialization enabled", {}, "apply", false, { ALLOW_STARTUP_DB_SYNC: "1" });
  await check("different live database", {}, "apply", false, { DATABASE_URL: "postgres://other.invalid/test" });
  await check("unset environment", { UnsetEnvironment: "NODE_ENV" });
  await check("rebuild hook", { ExecStartPre: "/bin/sh -c pnpm build" });
  await check("shell entry", { ExecStart: "{ path=/bin/sh ; argv[]=/bin/sh -c node dist/index.mjs ; ignore_errors=no ; }" });
  await check("different compiled entry", { ExecStart: unit.ExecStart.replace("dist/index.mjs", "src/index.ts") });
  await check("unloaded service edit", { NeedDaemonReload: "yes" });
  // Model manager default 0, newly configured unit 1 and still-running 0.
  // The installer must mirror the unit flags, not reuse the inherited default.
  const changedUnit = { ...unit, Environment: "ALLOW_STARTUP_DB_SYNC=1" };
  const flagResult = spawnSync(process.execPath, ["artifacts/api-server/scripts/vps-db-setup.mjs", "flags"], {
    env: { ...env, UNIT_FIXTURE: Object.entries(changedUnit).map(([k, v]) => `${k}=${v}`).join("\n") },
    encoding: "utf8",
  });
  assert.equal(flagResult.status, 0);
  assert.equal(flagResult.stdout.trim(), "ALLOW_STARTUP_DB_SYNC=1");
  const mirrored = Object.fromEntries(flagResult.stdout.trim().split("\n").map(line => {
    const at = line.indexOf("=");
    return [line.slice(0, at), line.slice(at + 1)];
  }));
  await check("unit overrides inherited manager default", { Environment: changedUnit.Environment }, "apply", false, mirrored);
  await check("environment file overrides unit flag", { Environment: changedUnit.Environment }, "check", true);
  console.log(`VPS release guards: ${count} isolated checks passed.`);
} finally {
  keeper.kill();
  await rm(temp, { recursive: true, force: true });
}