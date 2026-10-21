import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { dataManifest, sequenceManifest } from "./data-manifest.mjs";

// Preparation only: creates a fresh final DB and a private replacement env file.
// It does NOT replace the running environment, open ingress or start the service.
process.umask(0o077);
const directory = process.env.MIGRATION_DIRECTORY;
if (process.env.MIGRATION_FINAL_APPROVED !== "1" ||
    !/^\/root\/itemmania-migration\/snapshot-final-[A-Za-z0-9-]+$/.test(directory || "")) {
  throw new Error("Approved final snapshot required");
}
if (!Object.values(networkInterfaces()).flat().some(v => v?.address === "85.11.190.63")) {
  throw new Error("Wrong destination");
}
const quote = value => `"${value.replaceAll('"', '""')}"`;
const literal = value => `'${value.replaceAll("'", "''")}'`;
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Client } = require("pg");
let client;
let phase = "preflight";
function postgres(sql) {
  return execFileSync("runuser", ["-u", "postgres", "--", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "postgres"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 300000,
  }).trim();
}
try {
  execFileSync("sha256sum", ["--check", "--quiet", "SHA256SUMS"], {
    cwd: directory, stdio: ["ignore", "ignore", "pipe"],
  });
  const state = execFileSync("systemctl", ["show", "itemmania", "-p", "ActiveState", "--value"], {
    encoding: "utf8",
  }).trim();
  if (state !== "inactive") throw new Error("Stop staging before final restore");
  const source = JSON.parse(await readFile(`${directory}/data-manifest.json`, "utf8"));
  if (source.quiesced !== true || !source.sequences) throw new Error("Not a quiesced final backup");
  const runtime = createHash("sha256")
    .update(await readFile("/opt/itemmania/artifacts/api-server/dist/index.mjs")).digest("hex");
  if (runtime !== source.runtimeHash) throw new Error("Runtime mismatch");
  const target = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname) ||
      (target.port && target.port !== "5432")) throw new Error("Nonlocal target DB");
  const role = decodeURIComponent(target.username);
  if (role === "postgres") throw new Error("Refuse superuser role");
  const name = `itemmania_final_${directory.split("snapshot-final-")[1].replaceAll("-", "_")}`;
  if (!/^[a-zA-Z0-9_]{1,63}$/.test(name)) throw new Error("Invalid fresh DB name");
  if (postgres(`SELECT count(*) FROM pg_database WHERE datname=${literal(name)};`) !== "0") {
    throw new Error("Final database already exists; never overwrite");
  }
  if (postgres(`SELECT count(*) FROM pg_roles WHERE rolname=${literal(role)} AND NOT rolsuper;`) !== "1") {
    throw new Error("Expected existing restricted role");
  }
  await copyFile("/etc/itemmania.env", `${directory}/environment-before-final.private`);
  phase = "create-fresh-final-db";
  postgres(`CREATE DATABASE ${quote(name)} OWNER ${quote(role)} TEMPLATE template0
    ENCODING ${literal(source.dbInfo.encoding)}
    LC_COLLATE ${literal(source.dbInfo.datcollate)} LC_CTYPE ${literal(source.dbInfo.datctype)};`);
  phase = "restore-final-transaction";
  execFileSync("runuser", ["-u", "postgres", "--", "pg_restore",
    "--exit-on-error", "--single-transaction", "--no-owner", "--no-acl",
    `--role=${role}`, `--dbname=${name}`], {
    input: await readFile(`${directory}/database.dump`),
    stdio: ["pipe", "ignore", "pipe"], timeout: 300000,
  });
  target.pathname = `/${name}`;
  client = new Client({ connectionString: target.href });
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  phase = "verify-final-data-and-sequences";
  const tables = await dataManifest(client);
  const sequences = await sequenceManifest(client);
  await client.query("COMMIT");
  if (JSON.stringify(tables) !== JSON.stringify(source.tables) ||
      JSON.stringify(sequences) !== JSON.stringify(source.sequences)) {
    throw new Error("Final data or sequence mismatch");
  }
  // Keep the initial staging uploads untouched until the verified final files
  // can be activated during the approved cutover.
  const uploads = `${directory}/files`;
  await mkdir(uploads, { mode: 0o700 });
  execFileSync("tar", ["-xzf", `${directory}/application-and-config.private.tar.gz`,
    "-C", uploads, "opt/itemmania/artifacts/uploads",
    "opt/itemmania/artifacts/api-server/uploads"], {
    stdio: ["ignore", "ignore", "pipe"], timeout: 300000,
  });
  const environment = (await readFile("/etc/itemmania.env", "utf8"))
    .split("\n").filter(line => !/^DATABASE_URL=/.test(line)).join("\n")
    + `\nDATABASE_URL=${JSON.stringify(target.href)}\n`;
  await writeFile(`${directory}/environment-final.private`, environment, { mode: 0o600 });
  await writeFile(`${directory}/final-verification.json`, JSON.stringify({
    runtime, tableCount: Object.keys(tables).length,
    sequenceCount: Object.keys(sequences).length,
    dataMatches: true, sequencesMatch: true,
    sourceCapturedAt: source.capturedAt, activated: false, dnsChanged: false,
  }, null, 2), { mode: 0o600 });
  console.log(`FINAL_DB_READY tables=${Object.keys(tables).length} sequences_match=true activated=false`);
} catch (error) {
  console.error(`FINAL_RESTORE_FAILED phase=${phase} type=${error.name}; no DB was dropped`);
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
