import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { guardFailure, forbidden, unauthenticated } from "@/modules/auth/lib/guard-response";

// The inline refusal predates the unified guard idiom; the sweep below scans
// every route file for it. Kept as a named regex so the positive-control test
// can prove the sweep is not vacuous.
const HAND_ROLLED_REFUSAL =
  /NextResponse\.json\(\s*\{ error: "(?:Unauthenticated|Forbidden)" \}\s*,\s*\{ status: (?:401|403) \}\s*\)/;

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

describe("unauthenticated", () => {
  it("answers identity re-verification failures with 401", async () => {
    const res = unauthenticated();

    expect(res.status).toBe(401);
  });

  it("renders the canonical Unauthenticated body", async () => {
    const res = unauthenticated();

    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
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

  it("matches a hand-rolled refusal so the sweep is not vacuous", () => {
    expect(HAND_ROLLED_REFUSAL.test('return NextResponse.json({ error: "Forbidden" }, { status: 403 });')).toBe(true);
    expect(HAND_ROLLED_REFUSAL.test('return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });')).toBe(true);
  });

  // The pre-unification form lived on `requireAuth` + a bare null check, so it
  // had no `guard.error` to pair a status with. Sheets 03-05 moved every such
  // handler onto requireRole()/requireMinRole() + guardFailure; this keeps the
  // inline NextResponse.json refusal from coming back.
  it("no route hand-rolls a guard refusal outside the helpers", () => {
    // `\s*` lets prettier wrap the call across lines without silently evading
    // the sweep — the single-line form is the common one today.
    const offenders = files.filter((f) => HAND_ROLLED_REFUSAL.test(readFileSync(f, "utf8")));

    expect(offenders.map((f) => path.relative(API_DIR, f))).toEqual([]);
  });
});
