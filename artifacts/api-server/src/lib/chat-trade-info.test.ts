import assert from "node:assert/strict";
import test from "node:test";
import { chatTradeInfo, chatTradeReference } from "./chat-trade-info";

test("trade header uses actual order ID/date and preserves the distinct room ID", () => {
  const room = { id: 24, orderId: 37, createdAt: new Date("2026-10-01T15:00:00Z") };
  const trade = { createdAt: new Date("2026-10-03T05:33:00Z") };
  const oldZone = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Seoul", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      assert.equal(chatTradeInfo(room, trade),
        "거래번호 #37 | 거래일시 2026-10-03 14:33:00 | 채팅방 #24");
    }
  } finally {
    if (oldZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldZone;
  }
});

test("no-order rooms show a stable reference, application time and separate room ID", () => {
  assert.equal(chatTradeInfo({ id: 24, orderId: null, createdAt: "2026-10-02T23:30:06Z" }),
    `거래참조번호 ${chatTradeReference(24)} | 신청일시 2026-10-03 08:30:06 | 채팅방 #24`);
  const room = { id: 30, orderId: null, createdAt: "2026-10-05T06:27:26Z" };
  const label = chatTradeInfo(room);
  assert.equal(label, chatTradeInfo(JSON.parse(JSON.stringify(room))));
  assert.match(label, /^거래참조번호 C-\d{10} /);
  assert.ok(!label.includes("미생성"));
  assert.ok(!label.includes("거래번호 #30"));
  assert.ok(label.includes("2026-10-05 15:27:26"));
  assert.equal(chatTradeInfo({ ...room, orderId: 37 }, { createdAt: room.createdAt }),
    "거래번호 #37 | 거래일시 2026-10-05 15:27:26 | 채팅방 #30");
});

test("references are unique, stable and valid across the supported room ID range", () => {
  const ids = [...Array.from({ length: 10000 }, (_, i) => i + 1), 2147483646, 2147483647];
  const references = ids.map(chatTradeReference);
  assert.equal(new Set(references).size, ids.length);
  assert.ok(references.every(reference => /^C-\d{10}$/.test(reference)));
  assert.equal(chatTradeReference(30), chatTradeReference(30));
  for (const id of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.throws(() => chatTradeReference(id), RangeError);
  }
});
test("missing order metadata does not invent an order timestamp or display a timezone suffix", () => {
  const label = chatTradeInfo({ id: 24, orderId: 37, createdAt: "2026-10-01T15:00:00Z" });
  assert.equal(label, "거래번호 #37 | 거래일시 미확인 | 채팅방 #24");
  assert.ok(!label.includes("한국 시간"));
  assert.ok(!label.includes("KST"));
  assert.ok(!chatTradeInfo({ id: 24, orderId: null, createdAt: "invalid" }).includes("Invalid"));
});