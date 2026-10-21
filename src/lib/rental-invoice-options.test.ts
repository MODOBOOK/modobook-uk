import { test } from "node:test";
import assert from "node:assert/strict";
import { rentalInvoiceOptions } from "./rental-invoice-options";

const profile = { invoice_account_name: "Clinic", invoice_sort_code: "00-00-00", invoice_account_number: "12345678", stripe_connect_account_id: "acct_test" };
test("bank invoices include bank details and never request Stripe", () => {
  assert.deepEqual(rentalInvoiceOptions("bank", profile, true), { bank: true, stripe: false });
  assert.throws(() => rentalInvoiceOptions("bank", {}, true), /bank transfer details/);
});
test("Stripe invoices exclude bank details and require a connection", () => {
  assert.deepEqual(rentalInvoiceOptions("stripe", profile, true), { bank: false, stripe: true });
  assert.throws(() => rentalInvoiceOptions("stripe", {}, true), /Connect Stripe/);
});
test("both includes both payment methods", () => {
  assert.deepEqual(rentalInvoiceOptions("both", profile, true), { bank: true, stripe: true });
});