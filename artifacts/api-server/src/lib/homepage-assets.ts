import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";

const images = new Map<string, { bytes: Buffer; mime: string; hash: string }>();
const urls = new Map<string, string>();
const mimeTypes: Record<string, string> = {
  png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg",
  webp: "image/webp", gif: "image/gif",
};

/** Only call with startup-built public artwork (home/game catalog), never member content. */
export function externalizeHomepageImages(html: string): string {
  return html.replace(/data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)/g,
    (original, type: string, encoded: string) => {
      const cached = urls.get(original);
      if (cached) return cached;
      const bytes = Buffer.from(encoded, "base64");
      // Tiny icons stay inline: a separate request would cost more than it saves.
      if (bytes.length < 1024 || bytes.toString("base64") !== encoded) return original;
      const hash = createHash("sha256").update(bytes).digest("hex");
      const filename = `${hash}.${type === "jpeg" ? "jpg" : type}`;
      const url = `/api/homepage-assets/${filename}`;
      images.set(filename, { bytes, mime: mimeTypes[type], hash });
      urls.set(original, url);
      return url;
    });
}

/** Reuse only artwork already registered by the public homepage, not private images. */
export function reuseHomepageImages(html: string): string {
  return html.replace(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/g,
    original => urls.get(original) ?? original);
}

export type HomepageImageMode = "desktop" | "hidden-desktop" | "mobile-overlay";

/** Preserve markup, dimensions, scripts and CSS; only change image delivery. */
export function optimizeHomepageImages(html: string, mode: HomepageImageMode): string {
  let index = 0;
  const optimized = externalizeHomepageImages(html);
  return optimized.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<img\b[^>]*>/gi, tag => {
    if (!/^<img\b/i.test(tag)) return tag;
    const lazy = mode === "hidden-desktop" || index >= (mode === "desktop" ? 12 : 7);
    index++;
    let attributes = "";
    if (!/\bdecoding\s*=/i.test(tag)) attributes += ' decoding="async"';
    if (lazy && !/\bloading\s*=/i.test(tag)) attributes += ' loading="lazy"';
    return attributes ? tag.replace(/\s*\/?>$/, ending => attributes + ending) : tag;
  });
}

export const homepageAssetsRouter: IRouter = Router();

homepageAssetsRouter.get("/api/homepage-assets/:filename", (req, res): void => {
  const filename = String(req.params.filename ?? "");
  const image = /^[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(filename) ? images.get(filename) : undefined;
  if (!image) {
    res.set("Cache-Control", "no-store").status(404).end();
    return;
  }
  res.set({
    "Content-Type": image.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "ETag": `"${image.hash}"`,
    "X-Content-Type-Options": "nosniff",
  });
  res.send(image.bytes);
});
