import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingFitsGap, bookingSlotStep, requiredBookingMinutes } from "./booking-duration";

test("zero-minute treatments keep zero duration and offer dates with free time under 15 minutes", () => {
  assert.equal(requiredBookingMinutes(0), 0);
  assert.equal(bookingFitsGap(5, 0), true);
  assert.equal(bookingFitsGap(0, 0), false);
});

test("positive-duration bookings still require a sufficiently long free gap", () => {
  assert.equal(bookingFitsGap(5, 30), false);
  assert.equal(bookingFitsGap(30, 30), true);
  assert.equal(requiredBookingMinutes(undefined), 15);
});

test("zero-minute treatments generate advancing time choices without changing duration", () => {
  const starts: number[] = [];
  for (let t = 660; t < 690; t += bookingSlotStep(0, 0)) starts.push(t);
  assert.deepEqual(starts, [660, 675]);
  assert.equal(bookingSlotStep(30, 0), 30);
});