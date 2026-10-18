import { test } from "node:test";
import assert from "node:assert/strict";
import { modelSlotMatchesLocation } from "./model-slot-location";

test("a location-assigned model slot only appears at that selected location", () => {
  assert.equal(modelSlotMatchesLocation("edinburgh", "edinburgh"), true);
  assert.equal(modelSlotMatchesLocation("edinburgh", "snatchural"), false);
  assert.equal(modelSlotMatchesLocation("edinburgh", null), false);
});

test("a model slot with no assigned location appears at all locations", () => {
  assert.equal(modelSlotMatchesLocation(null, "edinburgh"), true);
  assert.equal(modelSlotMatchesLocation(null, "snatchural"), true);
  assert.equal(modelSlotMatchesLocation(null, null), true);
});