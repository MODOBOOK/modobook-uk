import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceServicePaymentChoice, servicePaymentDueCents, servicePaymentRequirement, type ClinicDepositSettings } from "./service-payment";

const settings: ClinicDepositSettings = { enabled: true, fixedCents: 3000, percent: 0, type: "fixed", perBooking: false };

test("clinic settings retain the usual £30 deposit", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "clinic" }], settings), 3000);
});
test("a £150 full-payment service collects £150 instead of the £30 clinic deposit", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "full" }], settings), 15000);
});
test("mixed bookings collect £150 in full plus the other service’s £30 deposit", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "full" }, { amountCents: 8000, requirement: "clinic" }], settings), 18000);
});
test("custom deposits collect their fixed amount", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "deposit", depositAmount: 50 }], settings), 5000);
});
test("full payment follows the final discounted or changed service price", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 12000, requirement: "full" }], settings), 12000);
  assert.equal(servicePaymentDueCents([{ amountCents: 17500, requirement: "full" }], settings), 17500);
});
test("per-booking deposits cannot erase service overrides", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "full" }, { amountCents: 8000, requirement: "clinic" }, { amountCents: 9000, requirement: "clinic" }], { ...settings, perBooking: true }), 18000);
});
test("full payment and custom deposits work when clinic deposits are disabled", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "full" }, { amountCents: 8000, requirement: "deposit", depositAmount: 20 }], { ...settings, enabled: false }), 17000);
});
test("a zero deposit does not waive another service’s full payment", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 15000, requirement: "full" }, { amountCents: 8000, requirement: "deposit", depositAmount: 0 }], settings), 15000);
});
test("custom deposit never exceeds the service’s final price", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 2000, requirement: "deposit", depositAmount: 30 }], settings), 2000);
});
test("full-payment services cannot bypass payment with cash", () => {
  assert.deepEqual(enforceServicePaymentChoice({ mode: "cash", method: "card" }, [{ amountCents: 15000, requirement: "full" }], settings), { mode: "deposit", method: "card" });
});
test("full-payment services cannot bypass payment by saving card details", () => {
  assert.deepEqual(enforceServicePaymentChoice({ mode: "card_capture", method: "card" }, [{ amountCents: 15000, requirement: "full" }], settings), { mode: "deposit", method: "card" });
});
test("paying the whole mixed booking is still allowed", () => {
  assert.deepEqual(enforceServicePaymentChoice({ mode: "full", method: "klarna" }, [{ amountCents: 15000, requirement: "full" }], settings), { mode: "full", method: "klarna" });
});
test("existing custom deposits survive the default clinic value", () => {
  assert.equal(servicePaymentRequirement("clinic", 45), "deposit");
  assert.equal(servicePaymentRequirement("clinic", null), "clinic");
});
test("fully credited or free services need no payment", () => {
  assert.equal(servicePaymentDueCents([{ amountCents: 0, requirement: "full" }], settings), 0);
});