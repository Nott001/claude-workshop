import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "../src/app/api");

/**
 * Routes that are reachable without a session, each for a stated reason.
 * Adding to this list should be a deliberate, reviewed decision — it widens
 * the unauthenticated attack surface.
 */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  "auth/callback/route.ts": "OAuth callback — must be reachable before a session exists.",
};

/**
 * Routes that are missing a guard and should not be. Each entry is a known
 * finding, not an exemption. Remove the entry when the route is fixed; the
 * test then holds the fix in place.
 */
const KNOWN_UNGUARDED: Record<string, string> = {
  "storage/[bucket]/[...path]/route.ts":
    "Reads any bucket/key from the URL with the service client, bypassing RLS. " +
    "Relies entirely on the middleware session check. See SPEC-07 §3 (P0).",
};

function routeFiles(): string[] {
  return globSync("**/route.ts", { cwd: API_DIR })
    .sort()
    .map((f) => f.replace(/\\/g, "/"));
}

const guarded = (rel: string) => /requireAuth|requireRole/.test(readFileSync(path.join(API_DIR, rel), "utf8"));

describe("api route authorization sweep", () => {
  const files = routeFiles();

  it("finds the api routes to check", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("every route either enforces auth or is listed with a reason", () => {
    const unaccounted = files.filter((rel) => !guarded(rel) && !(rel in PUBLIC_BY_DESIGN) && !(rel in KNOWN_UNGUARDED));

    expect(unaccounted, `New API route(s) with no requireAuth/requireRole call:\n  ${unaccounted.join("\n  ")}`).toEqual([]);
  });

  it("keeps the public list minimal", () => {
    // A guard rail on the guard rail: if this list grows, someone should notice.
    expect(Object.keys(PUBLIC_BY_DESIGN)).toHaveLength(1);
  });

  it.each(Object.keys(PUBLIC_BY_DESIGN))("%s is genuinely unguarded, so the list stays honest", (rel) => {
    expect(files).toContain(rel);
    expect(guarded(rel)).toBe(false);
  });

  it.each(Object.keys(KNOWN_UNGUARDED))("%s is still unguarded — delete this entry once fixed", (rel) => {
    expect(files).toContain(rel);
    // When this fails, the route was fixed. Remove it from KNOWN_UNGUARDED.
    expect(guarded(rel)).toBe(false);
  });
});
