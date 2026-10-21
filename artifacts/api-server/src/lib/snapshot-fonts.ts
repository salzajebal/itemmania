import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const fonts = new Map<string, Buffer>();
const urls = new Map<string, string>();
type FontSubset = { hash: string; range: string };
let subsets: Record<string, FontSubset[]> = {};
for (const directory of [
  join(dirname(fileURLToPath(import.meta.url)), "font-subsets"),
  join(process.cwd(), "generated-artifacts/font-subsets"),
  join(process.cwd(), "../../generated-artifacts/font-subsets"),
]) {
  if (!existsSync(join(directory, "manifest.json"))) continue;
  subsets = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  for (const entries of Object.values(subsets)) {
    for (const entry of entries) {
      const bytes = readFileSync(join(directory, `${entry.hash}.woff2`));
      if (createHash("sha256").update(bytes).digest("hex") !== entry.hash) throw new Error("Font subset checksum mismatch");
      fonts.set(entry.hash, bytes);
    }
  }
  break;
}

/**
 * SingleFile snapshots embed the same WOFF2 files in every HTML document.
 * Replace them while loading each snapshot so browsers can cache the font
 * once across navigations, without caching personalized HTML.
 */
export function externalizeSnapshotFonts(html: string): string {
  const externalized = html.replace(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g, (original, encoded: string) => {
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
  return externalized.replace(/@font-face\s*\{[^}]*\}/gi, rule => {
    const source = /src\s*:\s*[^;]+/i.exec(rule)?.[0];
    const hash = source && /\/snapshot-fonts\/([a-f0-9]{64})\.woff2/.exec(source)?.[1];
    const entries = hash ? subsets[hash] : undefined;
    // Existing ranged declarations and unknown/icon fonts remain untouched.
    if (!source || !entries || /unicode-range\s*:/i.test(rule)) return rule;
    return entries.map(entry => rule.replace(source, source.replace(hash!, entry.hash))
      .replace(/\}$/, `;unicode-range:${entry.range}}`)).join("");
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