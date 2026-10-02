import * as cheerio from "cheerio";
import type { ListingProduct } from "./mobile-product-list";

const CATEGORIES = new Set(["게임머니", "아이템", "계정", "기타"]);

/**
 * Use the already captured game-specific listing as an initial read-only view.
 * These archived entries are never written to the products table as live offers.
 */
export function parseSnapshotListings(html: string, gameName: string): ListingProduct[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: ListingProduct[] = [];

  $(".search_list_premium li[data-tid], .search_list_normal li[data-tid]").each((_, element) => {
    const item = $(element);
    const id = item.attr("data-tid") ?? "";
    if (!/^\d{1,22}$/.test(id) || seen.has(id)) return;
    const title = item.find(".kind_title").first().text().trim();
    const itemCategory = item.find("[data-search=goods]").first().text().trim();
    if (!title || !CATEGORIES.has(itemCategory)) return;

    seen.add(id);
    const gradeClasses = item.find(".credit_mark_new, .credit_mark").first().attr("class") ?? "";
    const grade = ["vip", "platinum", "gold", "silver", "bronze"]
      .find(value => gradeClasses.split(/\s+/).includes(value));
    const scoreText = item.find("progress.g_progress").first().attr("value");
    const parsedScore = scoreText === undefined ? NaN : Number(scoreText);
    const markers = item.find(".sub_info, .col.quickicon, .col.info").text().replace(/\s+/g, " ");
    const listingClass = item.attr("class") ?? "";
    const goodsLabel = `${listingClass} ${title} ${item.find(".col.quantity").first().text()}`;
    const conditions = [
      markers.includes("200% 보상") && "premium200",
      markers.includes("200% 구매 보상") && "purchaseReward200",
      markers.includes("구매 할인") && "purchaseDiscount",
      markers.includes("우수 인증") && "verified",
    ].filter((value): value is string => typeof value === "string");
    const priceText = item.find(".trade_money").first().text().trim();
    const minPrice = item.find(".col.price > span:not(.trade_money)").first().text().trim().replace(/^최소\s*/, "");
    const time = item.find(".reg_date").first().text().trim();
    const timeParts = /^(\d{1,2}):(\d{2})$/.exec(time);
    const timestamp = timeParts
      ? Number(timeParts[1]) * 60 + Number(timeParts[2])
      : 0;

    items.push({
      id,
      title,
      sellerName: item.find("[data-search=server]").first().attr("data-title")?.trim()
        || item.find("[data-search=server]").first().text().trim() || gameName,
      sellerGrade: grade,
      goodsType: /홍정/.test(goodsLabel) ? "hongjeong"
        : /분할/.test(goodsLabel) ? "split" : "general",
      tradeState: item.hasClass("block_item") ? "ended" : "waiting",
      conditions,
      featured: item.closest(".search_list_premium").length > 0
        || (Number.isFinite(parsedScore) && parsedScore > 0 && parsedScore < 100),
      percentage: Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, parsedScore)) : undefined,
      immediate: item.find(".sub_info .badge").toArray().some(badge => $(badge).text().includes("즉시구매")),
      gameName,
      serverName: item.find("[data-search=server]").first().attr("data-title")?.trim()
        || item.find("[data-search=server]").first().text().trim() || "",
      itemCategory,
      price: Number((priceText.match(/[\d,]+/) ?? ["0"])[0].replaceAll(",", "")),
      quantity: item.find(".col.quantity").first().text().trim(),
      time,
      timestamp,
      online: item.text().includes("접속중") ? true : undefined,
      minPrice,
      unitPrice: priceText,
      source: "snapshot",
    });
  });

  return items.sort((a, b) => b.timestamp - a.timestamp);
}