import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dataManifest } from "./data-manifest.mjs";

process.umask(0o077);
const directory = process.env.MIGRATION_DIRECTORY;
if (!/^\/root\/itemmania-migration\/snapshot-[A-Za-z0-9-]+$/.test(directory || "")) {
  throw new Error("Explicit private migration snapshot required");
}
const quote = value => `"${value.replaceAll('"', '""')}"`;
const literal = value => `'${value.replaceAll("'", "''")}'`;
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
const verifyOnly = process.argv[2] === "verify-only";
let phase = "preflight";
function postgres(sql) {
  return execFileSync("runuser", ["-u", "postgres", "--", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "postgres"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1048576, timeout: 300000,
  }).trim();
}
try {
  const source = JSON.parse(await readFile(`${directory}/data-manifest.json`, "utf8"));
  const runtime = createHash("sha256")
    .update(await readFile("/opt/itemmania/artifacts/api-server/dist/index.mjs")).digest("hex");
  if (runtime !== source.runtimeHash) throw new Error("Runtime checksum mismatch");
  const db = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(db.hostname) ||
      (db.port && db.port !== "5432")) throw new Error("Refuse nonlocal restore");
  const name = decodeURIComponent(db.pathname.slice(1));
  const role = decodeURIComponent(db.username);
  const password = decodeURIComponent(db.password);
  if (["postgres", "template0", "template1"].includes(name) || role === "postgres") {
    throw new Error("Refuse system DB/role");
  }
  if (!verifyOnly) {
    phase = "create-empty-database";
    // Never overwrite an existing database or role, even on a staging server.
    const exists = postgres(`SELECT count(*) FROM pg_database WHERE datname=${literal(name)};`);
    const roleExists = postgres(`SELECT count(*) FROM pg_roles WHERE rolname=${literal(role)};`);
    if (exists !== "0" || roleExists !== "0") throw new Error("Target DB/role already exists");
    postgres(`SET log_statement='none';
      CREATE ROLE ${quote(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${literal(password)};
      CREATE DATABASE ${quote(name)} OWNER ${quote(role)} TEMPLATE template0
      ENCODING ${literal(source.dbInfo.encoding)}
      LC_COLLATE ${literal(source.dbInfo.datcollate)} LC_CTYPE ${literal(source.dbInfo.datctype)};`);
    phase = "restore-transaction";
    // Root owns the private dump; stream it to pg_restore, never loosen backup permissions.
    execFileSync("runuser", ["-u", "postgres", "--", "pg_restore",
      "--exit-on-error", "--single-transaction", "--no-owner", "--no-acl",
      `--role=${role}`, `--dbname=${name}`], {
      input: await readFile(`${directory}/database.dump`),
      stdio: ["pipe", "ignore", "pipe"], timeout: 300000,
    });
  }
  phase = "compare-restored-data";
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const restored = await dataManifest(client);
  await client.query("COMMIT");
  if (JSON.stringify(restored) !== JSON.stringify(source.tables)) {
    const mismatchedTables = [...new Set([...Object.keys(restored), ...Object.keys(source.tables)])]
      .filter(key => JSON.stringify(restored[key]) !== JSON.stringify(source.tables[key]));
    console.error(`DATA_COMPARISON_MISMATCH tables=${mismatchedTables.join(",")}`);
    throw new Error("Restored table counts or content hashes differ");
  }
  const report = {
    restoredAt: new Date().toISOString(), runtimeHash: runtime,
    tableCount: Object.keys(restored).length, allTableCountsAndHashesMatch: true,
    sourceCapturedAt: source.capturedAt, cutoverCompleted: false,
  };
  await writeFile(`${directory}/restore-verification.json`, JSON.stringify(report, null, 2));
  console.log(`RESTORE_VERIFIED tables=${report.tableCount} all_rows_match=true runtime=${runtime}`);
} catch (error) {
  console.error(`RESTORE_FAILED phase=${phase} type=${error.name}; private target left intact for diagnosis`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
