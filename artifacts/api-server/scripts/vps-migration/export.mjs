import { mkdir, chmod, writeFile, stat, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dataManifest, sequenceManifest } from "./data-manifest.mjs";

process.umask(0o077);
const require = createRequire("/opt/itemmania/lib/db/package.json");
const { Client } = require("pg");
const directory = process.env.MIGRATION_DIRECTORY;
const expectedRuntime = process.env.EXPECTED_RUNTIME;
const quiesced = process.env.MIGRATION_QUIESCED === "1";
if (!/^\/root\/itemmania-migration\/snapshot-[A-Za-z0-9-]+$/.test(directory || "") ||
    !/^[a-f0-9]{64}$/.test(expectedRuntime || "")) {
  throw new Error("Explicit private snapshot directory and expected runtime required");
}
const client = new Client({ connectionString: process.env.DATABASE_URL });
let transactionOpen = false;
try {
  // Snapshots are immutable: never overwrite an earlier successful backup.
  await mkdir(directory, { recursive: false, mode: 0o700 });
  await chmod(directory, 0o700);
  if (quiesced) {
    if (process.env.MIGRATION_FINAL_APPROVED !== "1") throw new Error("Write-stop approval required");
    const active = execFileSync("systemctl", ["show", "itemmania", "-p", "ActiveState", "--value"], {
      encoding: "utf8",
    }).trim();
    if (active !== "inactive") throw new Error("Origin is still active");
  }
  const runtime = "/opt/itemmania/artifacts/api-server/dist/index.mjs";
  const runtimeHash = createHash("sha256").update(await readFile(runtime)).digest("hex");
  if (runtimeHash !== expectedRuntime) throw new Error("Runtime changed; stop export");
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  transactionOpen = true;
  if (quiesced) {
    const peers = (await client.query(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname=current_database() AND pid<>pg_backend_pid()`)).rows[0].count;
    if (peers !== 0) throw new Error("Other origin database connections remain");
  }
  const snapshot = (await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
  const db = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(db.hostname)) {
    throw new Error("Expected an origin-local database");
  }
  const pgEnv = {
    ...process.env, PGHOST: db.hostname, PGPORT: db.port || "5432",
    PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password),
    PGDATABASE: decodeURIComponent(db.pathname.slice(1)),
  };
  execFileSync("pg_dump", [
    "--format=custom", "--no-owner", "--no-acl", `--snapshot=${snapshot}`,
    "--file", `${directory}/database.dump`,
  ], { env: pgEnv, stdio: ["ignore", "ignore", "pipe"], timeout: 300000 });
  execFileSync("pg_restore", ["--file=/dev/null", `${directory}/database.dump`], {
    stdio: ["ignore", "ignore", "pipe"], timeout: 300000,
  });
  const tables = await dataManifest(client);
  const sequences = quiesced ? await sequenceManifest(client) : null;
  const dbInfo = (await client.query(`SELECT pg_encoding_to_char(encoding) AS encoding,
    datcollate, datctype FROM pg_database WHERE datname=current_database()`)).rows[0];
  await client.query("COMMIT");
  transactionOpen = false;
  const manifest = {
    capturedAt: new Date().toISOString(), runtimeHash, dbInfo, tables, sequences, quiesced,
    note: quiesced ? "Final write-stopped snapshot; origin app remains inactive."
      : "Staging snapshot only. Final quiesced resynchronization required before cutover.",
  };
  await writeFile(`${directory}/data-manifest.json`, JSON.stringify(manifest, null, 2));
  // Keep runtime, its actual dependencies, snapshots, both upload locations,
  // original source, TLS and settings together. Do not copy obsolete releases.
  execFileSync("tar", [
    "-czf", `${directory}/application-and-config.private.tar.gz`,
    "--exclude=opt/itemmania/backups",
    "--exclude=opt/itemmania/.release-backups",
    "--exclude=opt/itemmania/.release-stage-*",
    "--exclude=opt/itemmania/artifacts/api-server/dist.*",
    "-C", "/", "opt/itemmania", "etc/itemmania.env", "etc/nginx",
    "etc/letsencrypt", "etc/systemd/system/itemmania.service", "usr/local/bin/node",
  ], { stdio: ["ignore", "ignore", "pipe"], timeout: 300000 });
  execFileSync("tar", ["-tzf", `${directory}/application-and-config.private.tar.gz`], {
    stdio: ["ignore", "ignore", "pipe"], timeout: 300000,
  });
  if (createHash("sha256").update(await readFile(runtime)).digest("hex") !== runtimeHash) {
    throw new Error("Runtime changed during export");
  }
  const files = ["database.dump", "data-manifest.json", "application-and-config.private.tar.gz"];
  const checksums = [];
  for (const file of files) {
    const location = `${directory}/${file}`;
    if (!(await stat(location)).size) throw new Error("Empty snapshot artifact");
    await chmod(location, 0o600);
    checksums.push(`${createHash("sha256").update(await readFile(location)).digest("hex")}  ${file}`);
  }
  await writeFile(`${directory}/SHA256SUMS`, checksums.join("\n") + "\n");
  console.log(`SNAPSHOT_VERIFIED tables=${Object.keys(tables).length} runtime=${runtimeHash}`);
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  // Errors may contain DB URLs/SQL/customer values; report only their class.
  console.error(`EXPORT_FAILED ${error.name}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
