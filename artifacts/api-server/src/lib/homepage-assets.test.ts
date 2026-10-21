import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import express from "express";
import { load } from "cheerio";
import { externalizeSnapshotFonts } from "./snapshot-fonts";
import { externalizeHomepageImages, optimizeHomepageImages, homepageAssetsRouter, reuseHomepageImages } from "./homepage-assets";
import { renderMobileHome } from "../routes/mobile-home";

const desktop = externalizeSnapshotFonts(readFileSync(new URL("../static/itemmania.html", import.meta.url), "utf8"));
const mobile = renderMobileHome(desktop);

test("home artwork retains exact bytes, deduplicates, caches publicly without loading sessions", async () => {
  const data = /data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]{2000,})/.exec(desktop)!;
  assert.ok(data);
  const url = externalizeHomepageImages(data[0]);
  assert.ok(url.startsWith("/api/homepage-assets/"));
  assert.equal(externalizeHomepageImages(data[0] + "|" + data[0]), url + "|" + url);
  const app = express();
  app.use(homepageAssetsRouter);
  let sessions = 0;
  app.use((_req, res) => { sessions++; res.status(500).end(); });
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    const r = await fetch(base + url);
    assert.equal(r.status, 200);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), Buffer.from(data[2], "base64"));
    assert.equal(r.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(r.headers.get("set-cookie"), null);
    assert.equal((await fetch(base + url, { headers: {
      "If-None-Match": r.headers.get("etag")!, "Cache-Control": "max-age=0",
    } })).status, 304);
    assert.equal((await fetch(base + "/api/homepage-assets/" + "f".repeat(64) + ".png")).status, 404);
    assert.equal((await fetch(base + url, { method: "HEAD" })).status, 200);
    assert.equal(sessions, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("only image delivery attributes/URLs change; elements, controls, style and scripts are retained", () => {
  for (const [source, mode] of [[desktop, "desktop"], [desktop, "hidden-desktop"], [mobile, "mobile-overlay"]] as const) {
    const optimized = optimizeHomepageImages(source, mode);
    assert.ok(Buffer.byteLength(optimized) < Buffer.byteLength(source) * 0.35);
    const original = load(source), changed = load(optimized);
    const normalize = ($: ReturnType<typeof load>) => {
      $("img").removeAttr("decoding").removeAttr("loading");
      $("[src]").each((_i, el) => {
        const src = $(el).attr("src")!;
        if (src.startsWith("data:image/") || src.startsWith("/api/homepage-assets/"))
          $(el).attr("src", "SAME-ARTWORK");
      });
      return $.html().replace(/data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+|\/api\/homepage-assets\/[a-f0-9]{64}\.(png|jpg|webp|gif)/g, "SAME-ARTWORK");
    };
    assert.equal(normalize(changed), normalize(original));
    const parsed = load(optimized);
    assert.equal(parsed("img").first().attr("loading"), mode === "hidden-desktop" ? "lazy" : undefined);
    assert.ok(parsed('img[loading="lazy"]').length > 0);
  }
});

test("small icons and malformed image data stay inline; JS image-building strings remain executable", () => {
  const tiny = "data:image/png;base64," + Buffer.from("tiny").toString("base64");
  assert.equal(externalizeHomepageImages(tiny), tiny);
  const source = `<script>const markup='<img src="${tiny}">';</script><img src="${tiny}" width="12" height="12">`;
  const optimized = optimizeHomepageImages(source, "hidden-desktop");
  assert.ok(optimized.includes(`<script>const markup='<img src="${tiny}">';</script>`));
  assert.ok(optimized.includes('width="12" height="12" decoding="async" loading="lazy"'));
});

test("shared artwork reuse never registers member images; private responses remain uncached", () => {
  const publicImage = desktop.match(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/g)!
    .find(value => value.length > 3000)!;
  const known = externalizeHomepageImages(publicImage);
  assert.equal(reuseHomepageImages(publicImage), known);
  const privateImage = "data:image/png;base64," + Buffer.alloc(4096, 47).toString("base64");
  assert.equal(reuseHomepageImages(privateImage), privateImage);
  const source = readFileSync(new URL("../routes/proxy.ts", import.meta.url), "utf8");
  assert.ok(source.includes('return reuseHomepageImages(externalizeSnapshotFonts(readFileSync(path, "utf-8")))'));
  assert.ok(source.includes('const mobileHomeHtml = staticHtml ? renderMobileHome(staticHtml) : ""'));
  assert.ok(source.includes('serveItemmania(mobile ? mobileHomepageBaseHtml : desktopHomepageHtml, user, mobile)'));
  assert.ok(source.includes('res.set("Cache-Control", "no-store, no-cache, must-revalidate")'));
});
