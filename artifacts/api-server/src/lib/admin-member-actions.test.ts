import assert from "node:assert/strict";
import test from "node:test";
import { parseBalanceChange, MemberActionError } from "./admin-member-actions";

test("direct final balance supports zero; addition stays explicit", () => {
  assert.deepEqual(parseBalanceChange({ amount: 0, mode: "set" }), { amount: 0, mode: "set" });
  assert.deepEqual(parseBalanceChange({ amount: 3000, mode: "set" }), { amount: 3000, mode: "set" });
  assert.deepEqual(parseBalanceChange({ amount: 2000, mode: "add" }), { amount: 2000, mode: "add" });
});

test("money input rejects blank, decimal, negative, non-finite and unsafe values", () => {
  for (const amount of [undefined, null, "", "1000", 1.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseBalanceChange({ amount, mode: "set" }), MemberActionError);
  }
  assert.throws(() => parseBalanceChange({ amount: 1, mode: "other" }), MemberActionError);
});
