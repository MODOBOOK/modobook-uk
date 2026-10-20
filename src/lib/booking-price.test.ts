import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPriceMatches,
  PriceMismatchError,
  PRICE_TOLERANCE,
} from "./booking-price.server";

// The server recomputes every booking price and rejects the booking when the
// browser's amount doesn't match — this is what stops someone picking their
// own price.

test("accepts a browser price that matches the server price", () => {
  assert.equal(assertPriceMatches(150, 150), 150);
});

test("accepts rounding differences within one penny", () => {
  assert.equal(assertPriceMatches(83.333333, 83.33), 83.333333);
  assert.equal(assertPriceMatches(100, 100.01), 100);
});

test("rejects a browser price below the server price", () => {
  assert.throws(() => assertPriceMatches(150, 1), PriceMismatchError);
  assert.throws(() => assertPriceMatches(150, 149.98), PriceMismatchError);
});

test("rejects a browser price above the server price", () => {
  assert.throws(() => assertPriceMatches(150, 150.02), PriceMismatchError);
});

test("rejects non-numeric browser prices", () => {
  assert.throws(() => assertPriceMatches(150, Number.NaN), PriceMismatchError);
  assert.throws(() => assertPriceMatches(150, Number.POSITIVE_INFINITY), PriceMismatchError);
});

test("tolerance is just over one penny", () => {
  assert.ok(PRICE_TOLERANCE > 0.01 && PRICE_TOLERANCE < 0.02);
});
