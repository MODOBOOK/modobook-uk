import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentInWindow, appointmentWindowMessage } from "./discount-window";

test("accepts January and February appointments", () => {
  assert.equal(appointmentInWindow("2027-01-01", "2027-01-01", "2027-02-28"), true);
  assert.equal(appointmentInWindow("2027-02-28", "2027-01-01", "2027-02-28"), true);
});
test("rejects December and March appointments", () => {
  assert.equal(appointmentInWindow("2026-12-31", "2027-01-01", "2027-02-28"), false);
  assert.equal(appointmentInWindow("2027-03-01", "2027-01-01", "2027-02-28"), false);
});
test("explains the window to patients", () => {
  assert.equal(
    appointmentWindowMessage("2027-01-01", "2027-02-28"),
    "This code is only valid for appointments from 1 January 2027 to 28 February 2027.",
  );
});
