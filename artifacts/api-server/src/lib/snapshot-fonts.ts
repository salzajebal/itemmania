import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";

const fonts = new Map<string, Buffer>();
const urls = new Map<string, string>();

/**
 * SingleFile snapshots embed the same WOFF2 files in every HTML document.
 * Replace them while loading each snapshot so browsers can cache the font
 * once across navigations, without caching personalized HTML.
 */
export function externalizeSnapshotFonts(html: string): string {
  return html.replace(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g, (original, encoded: string) => {
    const cached = urls.get(encoded);
    if (cached) return cached;

    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("ascii", 0, 4) !== "wOF2") return original;

    const hash = createHash("sha256").update(bytes).digest("hex");
    const url = `/snapshot-fonts/${hash}.woff2`;
    fonts.set(hash, bytes);
    urls.set(encoded, url);
    return url;
  });
}

export const snapshotFontsRouter: IRouter = Router();

snapshotFontsRouter.get("/snapshot-fonts/:filename", (req, res): void => {
  const match = /^([a-f0-9]{64})\.woff2$/.exec(String(req.params.filename ?? ""));
  const font = match ? fonts.get(match[1]) : undefined;
  if (!font) {
    res.status(404).end();
    return;
  }

  res.set("Content-Type", "font/woff2");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(font);
});