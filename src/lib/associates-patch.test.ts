import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAssociatePatch } from "./associates.functions";

test("drops associate_profile_id and other link columns", () => {
  const out = sanitizeAssociatePatch({ associate_profile_id: "x", clinic_profile_id: "y", invite_token: "t", accepted_at: "n", notes: "ok" });
  assert.deepEqual(out, { notes: "ok" });
});
test("never lets status be forced to active", () => {
  assert.throws(() => sanitizeAssociatePatch({ status: "active" }));
  assert.deepEqual(sanitizeAssociatePatch({ status: "revoked" }), { status: "revoked" });
});
