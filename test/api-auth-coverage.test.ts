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
  "auth/invite/route.ts":
    "Invitation acceptance — the invitee has no session, and creating one is the point. " +
    "The single-use token in the request body is the credential, and the submission must be same-origin.",
  "auth/recover/route.ts":
    "Password reset request — a locked-out user has no session, which is the point. " +
    "Holds no credential and reveals nothing: it answers identically for every address, " +
    "and is rate limited per address and per origin so it cannot flood a mailbox.",
  "auth/recover/confirm/route.ts":
    "Password reset completion — the single-use token in the request body is the credential, " +
    "same as invitation acceptance, and the submission must be same-origin.",
  "dev/profiler/route.ts":
    "Dev-only browser profiler sink. Self-404s on production builds, and anonymous visitors' " +
    "samples must still reach the dev terminal, so it cannot sit behind a session.",
  "events/[id]/schedule/route.ts":
    "Public course schedule for guests — module name, window and speaker name only. " +
    "Lesson content stays behind the authenticated /api/courses/event/[id] route, so there is " +
    "no credential and no session required.",
  "payments/webhook/route.ts":
    "Payment provider webhook. The provider HMAC-signs the raw body with its salt and the " +
    "adapter verifies it before touching anything, so the signature — not a session — is the " +
    "credential, and HitPay's retries must never hit a login wall.",
  "surveys/[token]/route.ts":
    "Survey form opener — the random per-recipient token in the URL is the credential, " +
    "so no session is required or appropriate.",
  "surveys/[token]/submit/route.ts":
    "Survey form submit — same token credential as the GET opener; the submission is " +
    "idempotent (a token only submits once) so a drive-by cannot do damage.",
};

/**
 * Routes that are missing a guard and should not be. Each entry is a known
 * finding, not an exemption. Remove the entry when the route is fixed; the
 * test then holds the fix in place.
 */
const KNOWN_UNGUARDED: Record<string, string> = {
  "qa/[eventId]/[messageId]/route.ts": "Deprecated — returns 410 Gone. Use /api/qa/module/[moduleId] instead.",
  "qa/[eventId]/route.ts": "Deprecated — returns 410 Gone. Use /api/qa/module/[moduleId] instead.",
};

function routeFiles(): string[] {
  return globSync("**/route.ts", { cwd: API_DIR })
    .sort()
    .map((f) => f.replace(/\\/g, "/"));
}

const guarded = (rel: string) => /requireAuth|requireMinRole|requireRole/.test(readFileSync(path.join(API_DIR, rel), "utf8"));

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
    expect(Object.keys(PUBLIC_BY_DESIGN)).toHaveLength(9);
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
