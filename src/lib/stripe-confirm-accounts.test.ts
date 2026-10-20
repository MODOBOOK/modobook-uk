import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmationAccountIds } from "./stripe-confirm-accounts";

test("payment confirmation checks the practitioner account when the clinic has no Stripe account", () => {
  assert.deepEqual(confirmationAccountIds(null, ["acct_practitioner"]), ["acct_practitioner"]);
});

test("payment confirmation searches clinic and retained practitioner accounts without duplicates", () => {
  assert.deepEqual(confirmationAccountIds("acct_clinic", ["acct_practitioner", "acct_clinic", null]), ["acct_clinic", "acct_practitioner"]);
});

test("no connected accounts means no account can be used to verify payment", () => {
  assert.deepEqual(confirmationAccountIds(null, [null, undefined, ""]), []);
});