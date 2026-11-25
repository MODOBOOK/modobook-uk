import { describe, expect, it } from "vitest";
import { appointmentInWindow, appointmentWindowMessage } from "./discount-window";

describe("discount code appointment window", () => {
  it("accepts January and February appointments", () => {
    expect(appointmentInWindow("2027-01-01", "2027-01-01", "2027-02-28")).toBe(true);
    expect(appointmentInWindow("2027-02-28", "2027-01-01", "2027-02-28")).toBe(true);
  });
  it("rejects December and March appointments", () => {
    expect(appointmentInWindow("2026-12-31", "2027-01-01", "2027-02-28")).toBe(false);
    expect(appointmentInWindow("2027-03-01", "2027-01-01", "2027-02-28")).toBe(false);
  });
  it("explains the window to patients", () => {
    expect(appointmentWindowMessage("2027-01-01", "2027-02-28")).toBe(
      "This code is only valid for appointments from 1 January 2027 to 28 February 2027.",
    );
  });
});
