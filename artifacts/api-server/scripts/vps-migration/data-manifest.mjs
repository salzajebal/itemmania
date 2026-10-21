import { createHash } from "node:crypto";

const quote = value => `"${value.replaceAll('"', '""')}"`;

// Run inside the same exported PostgreSQL snapshot as pg_dump. Never log rows.
export async function dataManifest(client) {
  // PostgreSQL renders timestamptz in its session timezone. Canonicalize that
  // serialization so different VPS installer defaults do not look like data loss.
  await client.query("SET LOCAL timezone = 'Etc/UTC'");
  await client.query("SET LOCAL datestyle = 'ISO, YMD'");
  await client.query("SET LOCAL extra_float_digits = 3");
  const tables = await client.query(`SELECT schemaname, tablename
    FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY schemaname COLLATE "C", tablename COLLATE "C"`);
  const result = {};
  for (const { schemaname, tablename } of tables.rows) {
    const qualified = `${quote(schemaname)}.${quote(tablename)}`;
    const rows = await client.query(`SELECT row_to_json(t)::text AS data
      FROM ${qualified} t ORDER BY row_to_json(t)::text COLLATE "C"`);
    const hash = createHash("sha256");
    for (const { data } of rows.rows) {
      hash.update(`${Buffer.byteLength(data)}:`);
      hash.update(data);
    }
    result[`${schemaname}.${tablename}`] = {
      count: rows.rows.length, sha256: hash.digest("hex"),
    };
  }
  return result;
}

export async function sequenceManifest(client) {
  const sequences = await client.query(`SELECT schemaname, sequencename
    FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY schemaname COLLATE "C", sequencename COLLATE "C"`);
  const result = {};
  for (const { schemaname, sequencename } of sequences.rows) {
    const state = await client.query(`SELECT last_value::text AS last_value,
      is_called FROM ${quote(schemaname)}.${quote(sequencename)}`);
    result[`${schemaname}.${sequencename}`] = state.rows[0];
  }
  return result;
}
