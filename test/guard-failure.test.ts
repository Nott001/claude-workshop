import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { guardFailure, forbidden } from "@/modules/auth/lib/guard-response";

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

describe("forbidden", () => {
  it("answers entitlement denials with 403", async () => {
    const res = forbidden();

    expect(res.status).toBe(403);
  });

  it("renders the canonical Forbidden body", async () => {
    const res = forbidden();

    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("never pairs a Forbidden body with a 401 status", () => {
    const res = forbidden();

    expect(res.status === 401).toBe(false);
  });
});

describe("route guard refusals go through the helper", () => {
  const API_DIR = path.resolve(__dirname, "../src/app/api");

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(full);
      return entry.name === "route.ts" ? [full] : [];
    });
  }

  const files = routeFiles(API_DIR);

  it("finds the route files it means to check", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  // The old form hard-coded the status next to `guard.error`, which is what let
  // 42 sites drift out of spec together. Centralising the mapping is the fix;
  // this keeps a new route from reintroducing the inline version.
  it("no route hard-codes a status alongside guard.error", () => {
    const offenders = files.filter((f) => /guard\.error\s*\}[^)]*status:\s*\d+/.test(readFileSync(f, "utf8")));

    expect(offenders.map((f) => path.relative(API_DIR, f))).toEqual([]);
  });
});
