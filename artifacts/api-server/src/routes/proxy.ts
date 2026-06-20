import { Router, type IRouter } from "express";
import { fetchProxyPage, injectScript } from "../lib/proxy";
import { logger } from "../lib/logger";
import { db, productsTable } from "@workspace/db";
import * as cheerio from "cheerio";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const ITEMMANIA_STATIC_BASE = "https://www.itemmania.com";
const MOBILE_ITEMMANIA_BASE = "https://m.itemmania.com";

function isMobileUA(ua: string): boolean {
  return /android|iphone|ipad|ipod|mobile|blackberry|opera mini/i.test(ua);
}

// 상품 데이터 크롤 및 DB 저장 (비동기, 실패해도 무관)
async function trySaveProduct(html: string, path: string): Promise<void> {
  try {
    const $ = cheerio.load(html);
    const title = $("h1, .item-title, .product-title").first().text().trim();
    const priceText = $(".price, .item-price, [class*=price]").first().text().replace(/[^0-9]/g, "");
    const price = parseInt(priceText, 10);
    const thumbnailUrl = $("img.thumb, .item-img img, .product-img img").first().attr("src") || null;
    const gameName = $(".game-name, .category-name").first().text().trim() || null;
    const sellerName = $(".seller-name, .nick").first().text().trim() || null;

    if (!title || !price) return;

    const itemmaniaId = path.split("/").filter(Boolean).pop() || path;

    await db.insert(productsTable).values({
      itemmaniaid: itemmaniaId,
      title,
      price,
      thumbnailUrl,
      gameName,
      sellerName,
      detailUrl: path,
      status: "active",
    }).onConflictDoUpdate({
      target: productsTable.itemmaniaid,
      set: { title, price, thumbnailUrl, gameName, sellerName, crawledAt: new Date() },
    });
  } catch {
    // 크롤 실패 무시
  }
}

// 정적 자원 패스스루 (이미지, CSS, JS, 폰트 등)
router.get("/proxy/{*splat}", async (req, res): Promise<void> => {
  const splat = Array.isArray(req.params.splat) ? req.params.splat.join("/") : (req.params.splat || "");
  const path = "/" + splat;
  const ua = req.headers["user-agent"] || "";
  const isMobile = isMobileUA(ua);
  const base = isMobile ? MOBILE_ITEMMANIA_BASE : ITEMMANIA_STATIC_BASE;

  // 정적 파일(이미지/CSS/JS/폰트)이면 직접 패스스루
  const ext = path.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const staticExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "css", "js", "woff", "woff2", "ttf", "eot", "mp4", "webm"];

  if (staticExts.includes(ext)) {
    const targetUrl = base + path + (req.query ? "?" + new URLSearchParams(req.query as Record<string, string>).toString() : "");
    try {
      const response = await fetch(targetUrl, {
        headers: { "User-Agent": ua },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        res.status(response.status).end();
        return;
      }
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=3600");
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch {
      res.status(502).end();
    }
    return;
  }

  // HTML 페이지: 프록시 + 스크립트 주입
  const result = await fetchProxyPage(path, ua);
  if (!result) {
    // itemmania가 다운됐을 때: DB에서 상품 찾아 서빙
    const itemId = path.split("/").filter(Boolean).pop() || "";
    const [product] = await db.select().from(productsTable).where(eq(productsTable.itemmaniaid, itemId));
    if (product) {
      res.json({ cached: true, product });
      return;
    }
    res.status(502).send(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h2>itemmania에 연결할 수 없습니다</h2>
        <p>잠시 후 다시 시도해주세요.</p>
        <a href="/">← 홈으로</a>
      </body></html>
    `);
    return;
  }

  // 비동기로 상품 저장 (응답 차단 없이)
  trySaveProduct(result.html, path).catch(() => {});

  const modified = injectScript(result.html, isMobile);

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Cache-Control", "no-cache");
  res.send(modified);
});

export default router;
