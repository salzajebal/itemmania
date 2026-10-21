import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import express from "express";
import { externalizeSnapshotFonts, snapshotFontsRouter } from "./snapshot-fonts";

test("captured fonts retain family/weight/style; generated subsets are cached independently of sessions", async () => {
  const html = readFileSync(new URL("../static/itemmania.html", import.meta.url), "utf8");
  const before = html.match(/@font-face\s*\{[^}]*\}/gi)!;
  const after = externalizeSnapshotFonts(before.join("")).match(/@font-face\s*\{[^}]*\}/gi)!;
  const properties = (rule: string) => rule.replace(/url\([^)]*\)/gi, "url()")
    .replace(/src\s*:[^;}]*/i, "")
    .replace(/unicode-range\s*:[^;}]+;?/i, "").replace(/;+/g, ";").replace(/;\}/g, "}");
  for (const rule of after) assert.ok(before.some(original => properties(original) === properties(rule)));
  const urls = [...new Set(after.join("").match(/\/snapshot-fonts\/[a-f0-9]{64}\.woff2/g))];
  assert.ok(urls.length >= 5);
  const app = express().use(snapshotFontsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address() as { port: number };
    for (const url of urls) {
      const response = await fetch(`http://127.0.0.1:${address.port}${url}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.ok(response.headers.get("cache-control")?.includes("immutable"));
      assert.equal(Buffer.from(await response.arrayBuffer()).toString("ascii", 0, 4), "wOF2");
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
