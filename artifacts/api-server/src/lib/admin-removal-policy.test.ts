import test from "node:test";
import assert from "node:assert/strict";
import { canRemoveAdminOrder, canHideAdminOrder, canRemoveAdminChat, canHideAdminChat } from "./admin-removal-policy";

test("only settled or cancelled orders are removable", () => {
  for (const status of ["completed", "cancelled"]) assert.equal(canRemoveAdminOrder({ status }), true);
  for (const status of ["pending", "shipped", "confirmed", "disputed"]) assert.equal(canRemoveAdminOrder({ status }), false);
  assert.equal(canRemoveAdminOrder({ status: "completed", adminDeletedAt: new Date() }), false);
});

test("only previously removed terminal orders can leave the deleted-items list", () => {
  for (const status of ["completed", "cancelled"]) {
    assert.equal(canHideAdminOrder({ status, adminDeletedAt: new Date() }), true);
    assert.equal(canHideAdminOrder({ status }), false);
    assert.equal(canHideAdminOrder({ status, adminDeletedAt: new Date(), adminHiddenAt: new Date() }), false);
  }
  for (const status of ["pending", "shipped", "confirmed", "disputed"]) {
    assert.equal(canHideAdminOrder({ status, adminDeletedAt: new Date() }), false);
  }
});

test("linked terminal chat records are removable, active linked trades remain protected", () => {
  for (const status of ["ended", "cancelled", "rejected"]) assert.equal(canRemoveAdminChat({ orderId: 123, status }), true);
  for (const status of ["pending", "active", "handover"]) assert.equal(canRemoveAdminChat({ orderId: 123, status }), false);
  assert.equal(canRemoveAdminChat({ orderId: null, status: "pending" }), true);
  assert.equal(canRemoveAdminChat({ orderId: null, status: "ended", adminDeletedAt: new Date() }), false);
});

test("chat cleanup requires first deletion and preserves linked active trades", () => {
  for (const orderId of [null, 123]) {
    for (const status of ["ended", "cancelled", "rejected"]) {
      assert.equal(canHideAdminChat({ orderId, status }), false);
      assert.equal(canHideAdminChat({ orderId, status, adminDeletedAt: new Date() }), true);
      assert.equal(canHideAdminChat({ orderId, status, adminDeletedAt: new Date(), adminHiddenAt: new Date() }), false);
    }
  }
  for (const status of ["pending", "active", "handover"]) {
    assert.equal(canHideAdminChat({ orderId: 123, status, adminDeletedAt: new Date() }), false);
    assert.equal(canHideAdminChat({ orderId: null, status, adminDeletedAt: new Date() }), true);
  }
});