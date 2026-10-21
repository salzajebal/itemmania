import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { load } from "cheerio";
import { MYROOM_STATS_SCRIPT } from "../src/lib/myroom-stats-script";

for (const file of ["myroom.html", "buy/buy_ing.html", "sell/sell_ing.html"]) {
  const $ = load(readFileSync(new URL("../src/static/" + file, import.meta.url), "utf8"));
  const document = {
    hidden: false, readyState: "complete", addEventListener() {},
    querySelector(selector: string) { return $(selector)[0]; },
    querySelectorAll(selector: string) {
      return $(selector).toArray().map(a => ({
        href: $(a).attr("href"),
        querySelectorAll(sel: string) {
          return $(a).find(sel).toArray().map(span => ({
            set textContent(value: string) { $(span).text(value); },
          }));
        },
      }));
    },
  };
  const ctx = createContext({
    document, window: { addEventListener() {} }, URL, setInterval() {},
    location: { pathname: "/myroom/index.html", href: "https://example.test/myroom/index.html" },
    fetch: async () => ({ ok: true, json: async () => ({ sellPending: 2, sellActive: 3, buyPending: 4, buyProcessing: 5 }) }),
  });
  new Script(MYROOM_STATS_SCRIPT.replace(/^<script>/, "").replace(/<[/]script>$/, "")).runInContext(ctx);
  await new Promise(resolve => setImmediate(resolve));
  for (const [path, expected] of [["sell/sell_ing", "3"], ["buy/buy_ing", "5"]]) {
    const badge = $(`.nav a[href*="/myroom/${path}.html"] span`).last().text();
    if (badge !== expected) throw new Error(`${file}: ${path} badge ${badge}, expected ${expected}`);
  }
  console.log(`${file}: existing sidebar badges refreshed correctly`);
}
