# SPEC-08 — Auth and authorization hardening

## Scope

Rename `requireRole` → `requireMinRole` (its current min-role semantics) and
introduce a new exact-role `requireRole` that rejects any role not explicitly
listed. Then close the role-but-not-ownership/assignment guard gaps across the API.
Changes semantics — this is the behavior hardening.

## Background

`src/modules/auth/lib/role-guard.ts:13` implements "minimum role":
`allowedRoles.some((r) => hasMinRole(user.role, r))`. Because every role clears
`hasMinRole(x, "attendee")`, allowlists like `requireRole("attendee", "facilitator")`
silently accept _every_ authenticated role (`tickets/route.ts:9`,
`payments/route.ts:85`, `payments/[id]/route.ts:9`, `tickets/[paymentId]/route.ts:10`,
`upload/profile-image/route.ts:16`). And `requireRole("facilitator", "speaker")` at
`speakers/[id]/route.ts:11` admits everyone but attendees. The intent at each site
is ambiguous, so the API must split by intent:

- `requireMinRole(role)` — the caller is "at least this level" (staff checks).
- `requireRole(...roles)` — the caller is exactly one of the listed roles.

Separately, several endpoints check role but not ownership/assignment, letting any
facilitator/speaker act on any record.

## Changes

- `role-guard.ts`: rename the existing export to `requireMinRole` (drop the
  variadic form — min-role checks take exactly one role) and add
  `requireRole(...allowedRoles: UserRole[])` that returns `{ allowed: true }` only
  when `allowedRoles.includes(user.role)` (empty list = any authenticated user).
- Sweep call sites by intent:
  - Single-role staff checks (`requireRole("facilitator")`, `requireRole("admin")`,
    `requireRole("speaker")`, `requireRole("super_admin")`) → `requireMinRole`.
  - Multi-role allowlists that meant "exactly one of these" → new `requireRole`
    with the literal list.
  - Multi-role lists that meant "everyone" (`profile-image/route.ts:16`) →
    `requireRole()` (no args).
  - `speakers/[id]/route.ts:11` ("facilitator or speaker" for GET) → `requireRole("facilitator", "speaker")`.
- Close the ownership/assignment gaps (use the SPEC-03 `event-service` where the
  resource is an event):
  - `api/events/[id]/route.ts:56,117` — PATCH/DELETE gate on `event-service`
    `canManageEvent` + the SPEC-03 capability matrix (already planned; landed here).
  - `api/events/[id]/publish/route.ts:9` — admin+ or assigned facilitator.
  - `api/events/[id]/attendees/route.ts:17` — admin+ or assigned facilitator.
  - `api/events/[id]/speakers/[profileId]/route.ts:10` — admin+ or assigned
    facilitator (unassign).
  - `api/courses/[id]/route.ts:12` — GET `requireCourseAccess` (like PATCH/DELETE);
    any speaker no longer reads any course tree.
  - `api/events/[id]/live/highlight/route.ts:44,102` — admin+ or assigned
    facilitator/speaker (SPEC-03 matrix).
  - `api/qa/message/[messageId]/route.ts:12` — only the asker, or admin+ / a
    facilitator or speaker assigned to that course.
  - `api/support/[messageId]/route.ts:12` — only a participant, or admin+ / the
    assigned facilitator.
  - `api/speakers/[id]/route.ts:45` — DELETE only by admin+, or the profile owner.
- Standardize the page guards that bypass `useRoleGuard`:
  - `staff/courses/page.tsx:26,50` — render a redirect instead of returning `null`
    (currently a permanently blank page).
  - `kiosk/page.tsx:20-23`, `staff/events/[id]/room/page.tsx:20-25` — keep their
    current behavior but route through `useRoleGuard`-style handling where practical.
- Middleware: add `/speaker/*` to the auth-gated paths (`middleware.ts:28-35`) so
  unauthenticated visitors are 302'd instead of served the shell + spinner.

## Non-goals

- No change to `hasMinRole` (client-side `useRoleGuard` uses it; keep as-is).
- No change to public GET endpoints or the middleware `isPublicApiGet` carve-outs.
- No rework of the SPEC-03 capability matrix — this spec consumes it.

## Files touched

- `src/modules/auth/lib/role-guard.ts` (rename + new exact-role function)
- ~35 API route files under `src/app/api/**` (call-site renames + guard additions)
- `src/middleware.ts` (speaker path gating)
- `src/app/staff/courses/page.tsx` (redirect instead of null)
- Tests: `test/role-guard.test.ts` (new: exact vs min matrix), update api-handler
  tests asserting the old `requireRole` behavior, add denial cases (unassigned
  facilitator/speaker → 403; cross-course speaker → 403 on QA/support).

## Verification

- `pnpm test` — new role-guard matrix test and updated handler tests green.
- `pnpm typecheck` — zero remaining `requireRole(` sites that meant min-role
  (grep the diff).
- `pnpm cf:build` succeeds.
- Manual: anonymous `/speaker/dashboard` 302s to sign-in.
