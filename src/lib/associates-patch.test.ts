import { describe, it, expect } from "vitest";
import { sanitizeAssociatePatch } from "./associates.functions";
describe("sanitizeAssociatePatch", () => {
  it("drops associate_profile_id and other link columns", () => {
    const out = sanitizeAssociatePatch({ associate_profile_id: "x", clinic_profile_id: "y", invite_token: "t", accepted_at: "n", notes: "ok" });
    expect(out).toEqual({ notes: "ok" });
  });
  it("never lets status be forced to active", () => {
    expect(() => sanitizeAssociatePatch({ status: "active" })).toThrow();
    expect(sanitizeAssociatePatch({ status: "revoked" })).toEqual({ status: "revoked" });
  });
});
