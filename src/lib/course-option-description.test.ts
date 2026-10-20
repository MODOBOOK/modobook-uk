import { test } from "node:test";
import assert from "node:assert/strict";
import { courseOptionDescription } from "./course-option-description";

test("copied descriptions stay hidden even when another option has custom wording", () => {
  assert.equal(courseOptionDescription("Shared information", ["Read the leaflet", "Shared information", "Shared information"]), null);
});

test("option-specific wording remains available", () => {
  assert.equal(courseOptionDescription("Read the leaflet", ["Read the leaflet", "Shared information", "Shared information"]), "Read the leaflet");
});

test("blank options do not cause shared copy to appear", () => {
  assert.equal(courseOptionDescription("Shared information", [null, "Shared information", "Shared information"]), null);
});