import assert from "node:assert/strict";
import test from "node:test";
import { listingTimeMarkup } from "./listing-time";

const originalZone = process.env.TZ;
test("registration times always show KST across host/device zones, including DST and date rollover", () => {
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Seoul", "UTC", "Europe/London"]) {
      process.env.TZ = zone;
      for (const [instant, expected] of [
        ["2026-10-02T09:30:06.000Z", "2026-10-02 18:30:06"],
        ["2026-10-01T23:30:06.000Z", "2026-10-02 08:30:06"],
        ["2026-03-08T09:30:06.000Z", "2026-03-08 18:30:06"],
        ["2026-10-01T15:00:00.000Z", "2026-10-02 00:00:00"],
      ]) {
        const date = new Date(instant);
        const desktop = listingTimeMarkup(date);
        assert.ok(desktop.endsWith(">" + expected + "</span>"));
        assert.ok(desktop.includes('title="한국 시간 (KST, UTC+9)"'));
        assert.ok(desktop.includes('data-listing-created-at="' + instant + '"'));
        assert.ok(listingTimeMarkup(date, false, true).endsWith(">" + expected.slice(0, -3) + "</span>"));
        assert.equal(listingTimeMarkup(date), desktop);
        assert.equal(date.toISOString(), instant);
      }
    }
  } finally {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});

test("server-rendered KST preserves the UTC instant and rejects invalid values", () => {
  const instant = new Date("2026-10-01T23:30:06Z");
  assert.ok(listingTimeMarkup(instant).includes("2026-10-02 08:30:06"));
  assert.ok(listingTimeMarkup(instant).includes('data-listing-created-at="2026-10-01T23:30:06.000Z"'));
  assert.ok(listingTimeMarkup(instant, false, true).includes('class="msd-date"'));
  assert.equal(instant.toISOString(), "2026-10-01T23:30:06.000Z");
  assert.equal(listingTimeMarkup("invalid"), "");
  assert.equal(listingTimeMarkup(undefined), "");
  assert.equal(listingTimeMarkup(null), "");
});