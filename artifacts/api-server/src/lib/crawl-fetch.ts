import * as cheerio from "cheerio";

export type CrawlProvider =
  | { kind: "firecrawl"; key: string }
  | { kind: "scraperapi"; key: string };

export function resolveCrawlProvider(scraperApiKey?: string): CrawlProvider | null {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (firecrawlKey) return { kind: "firecrawl", key: firecrawlKey };
  const legacyKey = scraperApiKey?.trim() || process.env.SCRAPER_API_KEY?.trim();
  return legacyKey ? { kind: "scraperapi", key: legacyKey } : null;
}

type FetchResult = { text: string | null; status: number | null; error: string | null };

function safeError(message: string, key: string): string {
  return message.replaceAll(key, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 240);
}

function scraperUrl(targetUrl: string, apiKey: string): string {
  return `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(targetUrl)}&render=true&premium=true&country_code=kr`;
}

export async function scraperFetch(url: string, apiKey: string, timeoutMs = 90000): Promise<FetchResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(scraperUrl(url, apiKey), {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
          Referer: "https://www.itemmania.com/",
        },
      });
      if (!resp.ok) {
        const body = safeError(await resp.text().catch(() => ""), apiKey);
        if (resp.status === 403 && /credit|quota|monthly|limit|소진|크레딧/i.test(body)) {
          return { text: null, status: resp.status, error: `ScraperAPI 월간 크레딧 소진 (HTTP 403): ${body}` };
        }
        if (attempt === 0 && (resp.status === 429 || resp.status >= 500)) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return { text: null, status: resp.status, error: `HTTP ${resp.status}: ${body}` };
      }
      const text = await resp.text();
      return text.trim().length >= 200
        ? { text, status: resp.status, error: null }
        : { text: null, status: resp.status, error: `빈 응답 (${text.trim().length}바이트)` };
    } catch (e) {
      if (attempt === 0 && ctrl.signal.aborted) continue;
      const message = e instanceof Error ? e.message : String(e);
      return { text: null, status: null, error: ctrl.signal.aborted ? "타임아웃" : safeError(message, apiKey) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { text: null, status: null, error: "요청 재시도 실패" };
}

export async function firecrawlFetch(url: string, apiKey: string, timeoutMs = 90000): Promise<FetchResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          formats: ["html"],
          onlyMainContent: false,
          removeBase64Images: true,
          location: { country: "KR", languages: ["ko-KR"] },
          waitFor: 3000,
          timeout: 60000,
          maxAge: 0,
          storeInCache: false,
        }),
      });
      const result = await resp.json().catch(() => null) as {
        success?: boolean;
        error?: string;
        data?: { html?: string; metadata?: { url?: string } };
      } | null;
      if (!resp.ok || !result?.success) {
        const description = safeError(String(result?.error ?? "Firecrawl 응답 오류"), apiKey);
        if (resp.status === 402 || /credit|quota|크레딧|잔액|balance/i.test(description)) {
          return { text: null, status: resp.status, error: `Firecrawl 크레딧 소진 (HTTP ${resp.status}): ${description}` };
        }
        if (attempt === 0 && (resp.status === 429 || resp.status >= 500)) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return { text: null, status: resp.status, error: `Firecrawl HTTP ${resp.status}: ${description}` };
      }
      const html = result.data?.html ?? "";
      if (html.trim().length < 200) {
        return { text: null, status: resp.status, error: "Firecrawl가 상품 HTML을 반환하지 않았습니다." };
      }
      const finalUrl = result.data?.metadata?.url;
      if (finalUrl) {
        const requested = new URL(url);
        const returned = new URL(finalUrl);
        if (returned.pathname !== requested.pathname ||
          (requested.searchParams.has("search_game") &&
            returned.searchParams.get("search_game") !== requested.searchParams.get("search_game"))) {
          return { text: null, status: resp.status, error: "Firecrawl가 요청한 게임 목록 대신 다른 페이지로 이동했습니다." };
        }
      }
      return { text: html, status: resp.status, error: null };
    } catch (e) {
      if (attempt === 0 && ctrl.signal.aborted) continue;
      const message = e instanceof Error ? e.message : String(e);
      return { text: null, status: null, error: ctrl.signal.aborted ? "Firecrawl 타임아웃" : safeError(message, apiKey) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { text: null, status: null, error: "Firecrawl 요청 재시도 실패" };
}

export function fetchCrawlHtml(url: string, provider: CrawlProvider): Promise<FetchResult> {
  return provider.kind === "firecrawl"
    ? firecrawlFetch(url, provider.key)
    : scraperFetch(url, provider.key);
}

export async function fetchPageHtml(
  gameId: number,
  page: number,
  provider: CrawlProvider,
  category: "sell" | "buy" = "sell",
): Promise<{ html: string | null; statusCode: number | null; error: string | null }> {
  const url = `https://www.itemmania.com/${category}/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
  const { text, status, error } = await fetchCrawlHtml(url, provider);
  if (!text) return { html: null, statusCode: status, error };
  const $ = cheerio.load(text);
  if (!$(".search_list_premium, .search_list_normal").length) {
    return { html: null, statusCode: status, error: "요청한 게임 목록 대신 다른 페이지가 반환됨 (상품 영역 없음)" };
  }
  return { html: text, statusCode: status, error: null };
}

export async function fetchDetailHtml(
  tid: string,
  provider: CrawlProvider,
  category: "sell" | "buy" = "sell",
): Promise<{ html: string | null; error: string | null }> {
  const url = `https://www.itemmania.com/${category}/application.html?id=${encodeURIComponent(tid)}`;
  const { text, error } = await fetchCrawlHtml(url, provider);
  return { html: text, error };
}