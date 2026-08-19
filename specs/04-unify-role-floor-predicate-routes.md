# 04 — Unify role-floor and predicate routes; fix the 403-for-anonymous bug

## Run order

Fourth. Requires sheets 01–03.

## Motivation

The second half of the split gates with `requireAuth` and folds a role test into
the null check:

```ts
const user = await requireAuth(supabase);
if (!user || !hasMinRole(user.role, ROLES.ADMIN)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Two problems. First, it answers **403 to an anonymous caller**, the exact 401/403
conflation the guards and `test/guard-failure.test.ts` exist to prevent. Second,
the role test is inline when a guard primitive already states it. Routes whose
entitlement is a role floor move to `requireMinRole()`; routes whose entitlement
is **not** a role (ownership, ticket-or-staff, "admin-or-attendee" disjunction)
guard with `requireRole()` and render the denial through `forbidden()`.

## Transformation rules

**Rule A — role floor.** Replace

```ts
const user = await requireAuth(supabase);
if (!user || !hasMinRole(user.role, ROLES.X)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// ...user.id / user.role uses
```

with

```ts
const guard = await requireMinRole(ROLES.X);
if (!guard.allowed) {
  return guardFailure(guard);
}
// ...guard.user uses
```

This is also the bug fix: anonymous now yields `guardFailure` → **401**, not 403.

**Rule B — non-role predicate.** Replace the `requireAuth` + `if (!user) 401`
block with:

```ts
const guard = await requireRole();
if (!guard.allowed) {
  return guardFailure(guard);
}
```

keep the predicate, and answer denials through `forbidden()`:

```ts
if (!predicate(guard.user)) {
  return forbidden();
}
```

**Cleanup:** drop `requireAuth` / `hasMinRole` imports once unused. Keep
`getServiceClient()`.

## Scope

### Rule A — role floors (also the 403→401 bug fix)

| File                                                      | Floor         | Note                                                    |
| --------------------------------------------------------- | ------------- | ------------------------------------------------------- |
| `src/app/api/support/cases/route.ts` (GET)                | `ADMIN`       | was `!user \|\| !hasMinRole(ADMIN)` → 403 for anonymous |
| `src/app/api/support/users/route.ts` (GET)                | `FACILITATOR` | same bug                                                |
| `src/app/api/support/sessions/[userId]/route.ts` (DELETE) | `FACILITATOR` | same bug                                                |
| `src/app/api/support/sessions/route.ts` (GET)             | `FACILITATOR` | same bug                                                |

> The `let user` → `guard.user` rewrite also feeds the `support/users` route's
> inner `hasMinRole(u.role as UserRole, ROLES.FACILITATOR)` — that one inspects
> OTHER users' roles from DAO rows and stays exactly as it is.

### Rule B — non-role predicates

| File                                                                    | Guard           | Predicate after guard                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/api/support/route.ts` (GET, POST)                              | `requireRole()` | `hasMinRole(role, ADMIN) \|\| role === ROLES.ATTENDEE` — a disjunction no single floor/`requireRole` list expresses (admins _and up_, plus exact attendee), so keep it and deny via `forbidden()`; also honour the rate-limit 429 as today |
| `src/app/api/support/sessions/route.ts` (POST)                          | `requireRole()` | ownership: `targetUserId === user.id` or `hasMinRole(role, ADMIN)`; the "start own session" 400 and service calls stay                                                                                                                     |
| `src/app/api/courses/[courseId]/room/route.ts` (GET)                    | `requireRole()` | `hasMinRole(role, FACILITATOR) \|\| userHasCourseAccess(...)`; the course-null/event-not-started branch stays                                                                                                                              |
| `src/app/api/courses/event/[eventId]/route.ts` (GET)                    | `requireRole()` | same staff-or-course-access entitlement                                                                                                                                                                                                    |
| `src/app/api/courses/[courseId]/live/highlight/route.ts` (POST, DELETE) | `requireRole()` | `requireHighlightAccess` helper stays; its custom "Only assigned staff…" 403 stays (exempt from the guard-rail). Fixes the two `{ error: "Unauthorized" }, 401` refusals — `guardFailure` answers the canonical `Unauthenticated`/401      |
| `src/app/api/auth/me/route.ts` (GET, PATCH, DELETE)                     | `requireRole()` | PATCH keeps the exact-role gate `guard.user.role !== ROLES.SPEAKER` → `forbidden()` (a speaker-only resource; a floor would admit facilitators/admins who carry no bio). The `getCurrentUserId()` re-checks stay                           |

## Tests

- **Bug-fix regression:** each of `support/cases`, `support/users`,
  `support/sessions/[userId]`, `support/sessions` GET must now assert that an
  **anonymous** caller gets **401** (update the assertion that expected 403) and
  that the DAO was not called.
- Replace `vi.mock(...session, { requireAuth })` with
  `vi.mock(...role-guard, { requireMinRole, requireRole })` in the affected test
  files (`api-support-cases`, `api-support-routes`, `api-support-get`, etc.),
  following the sheet 03 recipe.
- For Rule B routes, denial assertions for the predicate now hit `forbidden()`
  and stay 403 — only the anonymous path changes to 401.
- `guard-failure`'s existing sweep ("no route hard-codes a status alongside
  guard.error") must still pass.

## Acceptance

- `rg -n '!user \|\|' src/app/api --glob "route.ts"` → 0 matches.
- `rg -n 'status: 401' src/app/api --glob "route.ts"` → no matches in this
  sheet's files (`live/highlight`'s two `"Unauthorized"` refused).
- Anonymous on support/cases·users·sessions·sessions/[userId] → 401.
- Coverage thresholds raised, never lowered.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
fix: authorize anonymous support and staff routes with 401, not 403

Four support routes folded hasMinRole into the null check, so a logged-out
caller earned the "Forbidden" reserved for the authenticated-but-unpermitted
— the pairing RFC 9110 rules out and guardFailure was built to prevent.
Routing them through requireMinRole answers unauthenticated with 401 while
keeping every permitted denial a 403.
```

CHANGELOG: add under fixed (user-visible status-code behaviour change).
