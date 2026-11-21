import { test } from "node:test";
import assert from "node:assert/strict";
import { overlaps } from "./booking-conflict.server";

const busy = (p: string | null) => ({ startMin: 14 * 60, endMin: 14 * 60 + 30, practitionerId: p });

test("another practitioner's appointment does not block", () => {
  assert.equal(overlaps(busy("A"), { start: "14:00", end: "14:30", practitionerId: "B" }), false);
});
test("same practitioner's appointment blocks", () => {
  assert.equal(overlaps(busy("A"), { start: "14:15", end: "14:45", practitionerId: "A" }), true);
});
test("unassigned appointment blocks everyone", () => {
  assert.equal(overlaps(busy(null), { start: "14:00", end: "14:30", practitionerId: "B" }), true);
});
test("back-to-back is not a clash", () => {
  assert.equal(overlaps(busy("A"), { start: "14:30", end: "15:00", practitionerId: "A" }), false);
});
