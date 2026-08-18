import { describe, it, expect } from "vitest";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { apiResponders } from "./helpers/api-surface";

/**
 * RFC 9110 separates the two refusals: 401 means the caller is not
 * authenticated, 403 means it is authenticated but not permitted. Every route
 * used to answer 401 with a "Forbidden" body — the one pairing the spec rules
 * out — so a client could not distinguish "log in" from "you may not do this".
 */
describe("guardFailure", () => {
  it("answers an unauthenticated caller with 401", async () => {
    const res = guardFailure({ allowed: false, error: "Unauthenticated", user: null });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
  });

  it("answers an authenticated but unpermitted caller with 403", async () => {
    const res = guardFailure({ allowed: false, error: "Forbidden", user: null });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("never pairs a Forbidden body with a 401 status", async () => {
    for (const error of ["Unauthenticated", "Forbidden"] as const) {
      const res = guardFailure({ allowed: false, error, user: null });
      const body = (await res.json()) as { error: string };

      expect(body.error === "Forbidden" && res.status === 401).toBe(false);
    }
  });
});

describe("guard refusals go through the helper", () => {
  const GUARD_HELPER = "modules/auth/lib/guard-response.ts";
  const files = apiResponders();

  it("finds the routes and the helpers that answer for them", () => {
    expect(files.length).toBeGreaterThan(40);
    expect(files.map((f) => f.rel)).toContain(GUARD_HELPER);
  });

  // The old form hard-coded the status next to `guard.error`, which is what let
  // 42 sites drift out of spec together. Centralising the mapping is the fix;
  // this keeps a new route from reintroducing the inline version. `guardFailure`
  // itself is the one place the pairing belongs, and the tests above pin it.
  it("nothing outside the helper hard-codes a status alongside guard.error", () => {
    const offenders = files
      .filter((f) => f.rel !== GUARD_HELPER)
      .filter((f) => /guard\.error\s*\}[^)]*status:\s*\d+/.test(f.code));

    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  // One condition, one word. "Unauthorized" is the wording the middleware used
  // to answer with, so a client detecting "needs to log in" had to know both,
  // and which one it got depended on which check caught the request first.
  it("answers a missing session in one word across every layer", () => {
    const offenders = files.filter((f) => /"Unauthorized"/.test(f.code));

    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});
