import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { listingQuantityLabel } from "./listing-quantity";

test("local item description never becomes its quantity", () => {
  const product = { itemmaniaid: "user_example", description: "공5\n캐릭터명: 캐릭터" };
  assert.equal(listingQuantityLabel(product), "-");
  assert.equal(product.description, "공5\n캐릭터명: 캐릭터");
  assert.equal(listingQuantityLabel({ sellerId: 42, description: "99개" }), "-");
});

test("captured quantity stays intact for imported items and currency", () => {
  for (const description of ["1개", "3개", "6억 메소", "100만 ~ 10억", "1 - 50,000만", "3,500 아데나", "무제한"]) {
    assert.equal(listingQuantityLabel({ itemmaniaid: "2026100612345", description }), description);
  }
});

test("missing quantities are unknown, never a fabricated one-item quantity", () => {
  for (const description of [null, "", "공5", "<img src=x onerror=alert(1)>", "5개 무료로 드려요"]) {
    assert.equal(listingQuantityLabel({ description }), "-");
  }
});

test("embedded formatter has no module dependencies", () => {
  const formatter = vm.runInNewContext(`(${listingQuantityLabel.toString()})`);
  assert.equal(formatter({ itemmaniaid: "user_example", description: "공5" }), "-");
  assert.equal(formatter({ description: "2개" }), "2개");
});

test("registered quantities, ranges and units take precedence over descriptions", () => {
  for (const quantity of ["1개", "5개", "10만 ~ 500만", "6억 메소"]) {
    assert.equal(listingQuantityLabel({ itemmaniaid: "user_example", description: `수량: ${quantity}\n거래 유형: 일반\n공5` }), quantity);
    assert.equal(listingQuantityLabel({ quantityLabel: quantity, description: "공5" }), quantity);
  }
  assert.equal(listingQuantityLabel({ itemmaniaid: "user_example", description: "공5\n수량: 99개" }), "-");
  const formatter = vm.runInNewContext(`(${listingQuantityLabel.toString()})`);
  assert.equal(formatter({ itemmaniaid: "user_example", description: "수량: 5개\n설명" }), "5개");
});
