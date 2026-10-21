import { strict as assert } from "node:assert";
import { test } from "node:test";
import { listingCharacterName, normalizeTradeCharacterName, tradeCharacterNames, publicListingDescription } from "./trade-character-names";

test("nickname metadata is explicit, trimmed and bounded; account IDs are not inferred", () => {
  assert.equal(normalizeTradeCharacterName(" 닉네임🎮 "), "닉네임🎮");
  assert.equal(normalizeTradeCharacterName("  "), null);
  assert.throws(() => normalizeTradeCharacterName(123));
  assert.throws(() => normalizeTradeCharacterName("a".repeat(101)));
  assert.throws(() => normalizeTradeCharacterName("first\nsecond"));
  assert.equal(listingCharacterName("일반 설명\n캐릭터명: 등록닉네임"), "등록닉네임");
  assert.equal(listingCharacterName("캐릭터명: 설명예시\n캐릭터명: 실제입력"), "실제입력");
  assert.equal(listingCharacterName("사이트 아이디: account"), null);
});

test("sell listing owner is the seller and legacy application name is the buyer", () => {
  assert.deepEqual(tradeCharacterNames({ characterName: "구매자캐릭터" },
    { category: "sell", description: "캐릭터명: 판매자캐릭터" }),
  { buyerCharacterName: "구매자캐릭터", sellerCharacterName: "판매자캐릭터" });
});

test("buy listing owner is the buyer and legacy application name is the seller", () => {
  assert.deepEqual(tradeCharacterNames({ characterName: "판매자캐릭터" },
    { category: "buy", description: "캐릭터명: 구매자캐릭터" }),
  { buyerCharacterName: "구매자캐릭터", sellerCharacterName: "판매자캐릭터" });
});

test("stored per-trade names survive listing edits/deletion and do not swap roles", () => {
  const room = { buyerCharacterName: "원래구매자", sellerCharacterName: "원래판매자", characterName: "구형값" };
  const expected = { buyerCharacterName: "원래구매자", sellerCharacterName: "원래판매자" };
  assert.deepEqual(tradeCharacterNames(room, { category: "buy", description: "캐릭터명: 변경됨" }), expected);
  assert.deepEqual(tradeCharacterNames(room, null), expected);
  assert.deepEqual(tradeCharacterNames({ characterName: "역할불명" }, null),
    { buyerCharacterName: null, sellerCharacterName: null });
});

test("buy registration is private until a seller supplies the application name", () => {
  const product = { category: "buy", description: "일반 설명", registeredCharacterName: "비공개구매자", characterNameInDescription: false };
  assert.deepEqual(tradeCharacterNames({}, product), { buyerCharacterName: null, sellerCharacterName: null });
  assert.deepEqual(tradeCharacterNames({ sellerCharacterName: "신청판매자" }, product),
    { buyerCharacterName: "비공개구매자", sellerCharacterName: "신청판매자" });
});

test("only a marked legacy suffix is hidden; ordinary and explicitly typed descriptions remain", () => {
  const description = "본문\n캐릭터명: 본문예시\n캐릭터명: 자동추가";
  assert.equal(publicListingDescription({ category: "buy", description, characterNameInDescription: true }),
    "본문\n캐릭터명: 본문예시");
  assert.equal(publicListingDescription({ category: "buy", description, characterNameInDescription: false }), description);
  assert.equal(publicListingDescription({ category: "sell", description, characterNameInDescription: true }), description);
});