import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { load } from "cheerio";
import { installRegistrationQuantityInputs, normalizeQuantityLabel, registrationQuantityScript } from "./registration-quantity";

test("explicit quantities preserve registered counts, ranges and game units", () => {
  for (const label of ["1개", "5개", "10만 ~ 500만", "10만 ~ 1억", "6억 메소", "0.5억", "1,000골드"]) {
    assert.equal(normalizeQuantityLabel(label), label);
  }
  for (const invalid of [null, "", "0개", "-1개", "5개 ~ 1개", "Infinity", "공5", "<img src=x>", "1개\n<script>"]) {
    assert.equal(normalizeQuantityLabel(invalid), null);
  }
});

test("both real native registration snapshots contain one editable quantity-and-unit row", () => {
  for (const category of ["sell", "buy"] as const) {
    const html = readFileSync(new URL(`../static/${category}-register.html`, import.meta.url), "utf8");
    const $ = load(installRegistrationQuantityInputs(html, category));
    assert.equal($("[name=im_registration_quantity]").length, 1);
    assert.equal($("[name=im_registration_unit]").val(), "개");
    assert.equal($("[name=user_price]").length, 1);
    assert.equal($("[name=user_character]").length, 1);
  }
});

test("embedded registration reader sends the actual edited values, not a constant", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(registrationQuantityScript().replace(/^<script>|<\/script>$/g, ""), context);
  for (const [value, unit, expected] of [["1","개","1개"],["5","개","5개"],["10 ~ 500","만","10만 ~ 500만"],["6억 메소","개","6억 메소"]]) {
    const form = { querySelector(selector: string) { return { value: selector.includes("_unit") ? unit : value }; } };
    assert.equal(context.window._im_registration_quantity(form), expected);
  }
});

test("buy detail removes only the duplicate CTA and preserves the native application handler", () => {
  const source = readFileSync(new URL("../routes/proxy.ts", import.meta.url), "utf8");
  assert.ok(!source.includes("이 구매 요청에 판매하기"));
  assert.match(source, /function renderBuyBox\(p\)[\s\S]*?if \(type === 'buy'\) return;/);
  assert.ok(source.includes('class=btn_green onclick="window._im_on_sell_btn'));
  assert.ok(source.includes("quantityLabel: quantityLabel2"));
  assert.ok(source.includes("quantityLabel: quantityLabel,"));
  const mobile = readFileSync(new URL("../routes/mobile-sell-register.ts", import.meta.url), "utf8");
  assert.ok(mobile.includes("quantityLabel:draft.quantity?"));
  assert.ok(!mobile.includes("description.push('수량:"));
});
