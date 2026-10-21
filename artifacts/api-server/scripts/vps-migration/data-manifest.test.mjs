import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dataManifest, sequenceManifest } from "./data-manifest.mjs";

test("logical fingerprints canonicalize timezone and serialization before reading rows", async () => {
  const calls = [];
  const values = ['{"id":1,"value":"한글"}', '{"id":2,"value":null}'];
  const client = { async query(sql) {
    calls.push(sql);
    if (sql.includes("FROM pg_tables")) return { rows: [{ schemaname: "public", tablename: "evidence" }] };
    if (sql.includes("row_to_json")) return { rows: values.map(data => ({ data })) };
    return { rows: [] };
  } };
  const manifest = await dataManifest(client);
  assert.deepEqual(calls.slice(0, 3), [
    "SET LOCAL timezone = 'Etc/UTC'", "SET LOCAL datestyle = 'ISO, YMD'",
    "SET LOCAL extra_float_digits = 3",
  ]);
  const hash = createHash("sha256");
  for (const value of values) hash.update(`${Buffer.byteLength(value)}:`).update(value);
  assert.deepEqual(manifest, { "public.evidence": { count: 2, sha256: hash.digest("hex") } });
  assert.match(calls[4], /ORDER BY row_to_json\(t\)::text COLLATE "C"/);
});

test("table identifiers are escaped instead of interpreted as SQL", async () => {
  const calls = [];
  await dataManifest({ async query(sql) {
    calls.push(sql);
    if (sql.includes("FROM pg_tables")) return { rows: [{ schemaname: 's"chema', tablename: 'ta"ble' }] };
    return { rows: [] };
  } });
  assert.ok(calls.some(sql => sql.includes('FROM "s""chema"."ta""ble"')));
});

test("sequence comparison reads last_value and is_called without incrementing IDs", async () => {
  const calls = [];
  const manifest = await sequenceManifest({ async query(sql) {
    calls.push(sql);
    if (sql.includes("FROM pg_sequences")) {
      return { rows: [{ schemaname: "public", sequencename: "orders_id_seq" }] };
    }
    return { rows: [{ last_value: "9007199254740993", is_called: false }] };
  } });
  assert.deepEqual(manifest, { "public.orders_id_seq": {
    last_value: "9007199254740993", is_called: false,
  } });
  assert.ok(calls.every(sql => !/nextval|setval|UPDATE|INSERT|DELETE/i.test(sql)));
});
