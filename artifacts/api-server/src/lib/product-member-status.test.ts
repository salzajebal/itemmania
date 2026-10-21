import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "cheerio";
import { applyProductMemberStatus } from "./product-member-status";
import { renderMobileSellDetail } from "../routes/mobile-sell-detail";

for (const side of ["buy", "sell"]) {
  test(`${side} captured member info replaces the success rate with one online badge`, () => {
    const html = readFileSync(new URL(`../static/${side}-application-1.html`, import.meta.url), "utf8");
    const result = applyProductMemberStatus(html);
    const $ = load(result);
    assert.equal($(".user_info .success_rate").length, 0);
    assert.equal($(".user_info progress").length, 0);
    assert.equal($(".user_info .product-member-online").length, 1);
    assert.equal($(".product-member-online").text(), "접속중");
    assert.equal($(".product-member-online-dot").length, 1);
    assert.equal($(".user_info .vip_txt").text(), load(html)(".user_info .vip_txt").text());
    assert.equal($("ul.add_info").text(), load(html)("ul.add_info").text());
    assert.equal(applyProductMemberStatus(result), result);
  });
  test(`${side} mobile member info uses the same badge without adding a trade operation`, () => {
    const html = renderMobileSellDetail(
      { id: 1, sellerId: 2, category: side, sellerGrade: "vip", sellerCreditScore: 307, sellerName: "테스트" },
      null, new URL("../static/mobile-sell-assets/", import.meta.url).pathname,
    );
    const $ = load(html);
    assert.equal($("#msd-member-info .product-member-online").text(), "접속중");
    assert.equal($("#msd-member-info .product-member-online-dot").length, 1);
    assert.ok(!$("#msd-member-info").text().includes("거래성사율"));
    assert.equal($(".msd-score").text(), "307점");
  });
}

test("status transformation preserves unrelated snapshot bytes", () => {
  const source = '<html><head></head><body><p data-original=unchanged>본문</p><div class=user_info><span class="credit_mark vip">V</span><div><strong class=vip_txt>VIP</strong>307점<div class=success_rate>거래성사율<progress></progress><div>0%</div></div></div></div><ul class=add_info><li>휴대폰</li></ul><script>var original = 1;</script></body></html>';
  const result = applyProductMemberStatus(source);
  assert.ok(result.includes('<p data-original=unchanged>본문</p>'));
  assert.ok(result.includes('<script>var original = 1;</script>'));
  assert.equal(applyProductMemberStatus("<p>not a member card</p>"), "<p>not a member card</p>");
});

test("both public desktop detail handlers apply the member badge before returning", () => {
  const source = readFileSync(new URL("../routes/proxy.ts", import.meta.url), "utf8");
  for (const intercept of ["BUY_APPLICATION_INTERCEPT_SCRIPT", "SELL_APPLICATION_INTERCEPT_SCRIPT"]) {
    assert.ok(source.includes(`const combined = ${intercept} + APPLICATION_DYNAMIC_SCRIPT;\n  result = applyProductMemberStatus(result);`));
  }
});
