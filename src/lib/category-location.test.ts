import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryMatchesLocation } from "./category-location";

const categories = [{ id: "november", allowed_location_ids: ["glasgow", "edinburgh"] }];
test("November Edit appears in Glasgow", () => {
  assert.equal(categoryMatchesLocation("november", "glasgow", categories), true);
});
test("November Edit appears in Edinburgh", () => {
  assert.equal(categoryMatchesLocation("november", "edinburgh", categories), true);
});
test("November Edit does not appear in Coatbridge", () => {
  assert.equal(categoryMatchesLocation("november", "coatbridge", categories), false);
});
test("November Edit does not appear at other locations or without a selection", () => {
  assert.equal(categoryMatchesLocation("november", "other", categories), false);
  assert.equal(categoryMatchesLocation("november", null, categories), false);
});
test("Unrelated categories remain unchanged and children inherit restrictions", () => {
  assert.equal(categoryMatchesLocation("other", "coatbridge", categories), true);
  assert.equal(categoryMatchesLocation("child", "coatbridge", [...categories, { id: "child", parent_id: "november" }]), false);
});