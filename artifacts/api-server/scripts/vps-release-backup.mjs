import { mkdir, chmod, copyFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

// Executed only by the guarded db-setup helper inside the service environment.
// All artifacts remain root-private on the actual operating VPS.
export async function backupOperatingRelease({ pool, appRoot }) {
  const directory = `/root/itemmania-backups/release-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(directory, { recursive: false, mode: 0o700 });
  await chmod(directory, 0o700);
  const url = new URL(process.env.DATABASE_URL);
  const pgEnvironment = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
  if (url.searchParams.has("sslmode")) pgEnvironment.PGSSLMODE = url.searchParams.get("sslmode");
  const dump = path.join(directory, "database.dump");
  execFileSync("pg_dump", ["--format=custom", "--file", dump], {
    env: pgEnvironment, stdio: ["ignore", "ignore", "pipe"], timeout: 300000,
  });
  if ((await stat(dump)).size === 0) throw new Error("Empty database backup");
  // Parse and decompress the whole dump, but never connect to a restore DB.
  execFileSync("pg_restore", ["--file=/dev/null", dump], {
    stdio: ["ignore", "ignore", "pipe"], timeout: 300000,
  });
  const relativeUploads = ["artifacts/uploads", "artifacts/api-server/uploads"];
  const presentUploads = [];
  for (const relative of relativeUploads) {
    try {
      if ((await stat(path.join(appRoot, relative))).isDirectory()) presentUploads.push(relative);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  execFileSync("tar", [
    "-czf", path.join(directory, "runtime-and-uploads.tar.gz"), "-C", appRoot,
    "artifacts/api-server/dist", "artifacts/api-server/src/static", ...presentUploads,
  ], { stdio: ["ignore", "ignore", "pipe"], timeout: 300000 });
  execFileSync("tar", ["-tzf", path.join(directory, "runtime-and-uploads.tar.gz")], {
    stdio: ["ignore", "ignore", "pipe"], timeout: 300000,
  });
  await copyFile("/etc/itemmania.env", path.join(directory, "environment.private"));
  await writeFile(path.join(directory, "service.private"), execFileSync("systemctl", ["cat", "itemmania"]));
  const counts = await pool.query(`SELECT
    (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM wallets) AS wallets,
    (SELECT count(*) FROM products) AS products,
    (SELECT count(*) FROM orders) AS orders,
    (SELECT count(*) FROM chat_rooms) AS chat_rooms,
    (SELECT count(*) FROM chat_messages) AS chat_messages`);
  await writeFile(path.join(directory, "counts.json"), JSON.stringify(counts.rows[0], null, 2));
  const files = ["database.dump", "runtime-and-uploads.tar.gz", "environment.private", "service.private", "counts.json"];
  const { readFile } = await import("node:fs/promises");
  const manifest = [];
  for (const file of files) {
    const filename = path.join(directory, file);
    await chmod(filename, 0o600);
    manifest.push(`${createHash("sha256").update(await readFile(filename)).digest("hex")}  ${file}`);
  }
  await writeFile(path.join(directory, "SHA256SUMS"), manifest.join("\n") + "\n", { mode: 0o600 });
  console.log(`Verified operating DB/runtime/upload backup: ${directory}`);
}