# 03 — Route auth-only handlers through `requireRole()` + `guardFailure`

## Run order

Third. Requires sheets 01 and 02.

## Motivation

The largest half of the split: routes that only need _any authenticated caller_
gate with `requireAuth` and hand-roll the 401:

```ts
const user = await requireAuth(supabase);
if (!user) {
  return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
}
```

That duplicates the refusal rendering `guardFailure` centralises, and the bare
`AuthUser | null` return forces a null-check branch where a narrowed `.user`
belongs. `requireRole()` with an empty list is already the "any authenticated"
guard — `payments` GET, `tickets/*` and `upload/profile-image` prove the idiom —
so these handlers adopt it unchanged.

## The transformation rule

For every handler below, replace:

```ts
const user = await requireAuth(supabase);
if (!user) {
  return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
}
```

with:

```ts
const guard = await requireRole();
if (!guard.allowed) {
  return guardFailure(guard);
}
```

Then:

- Rename every later `user` use to `guard.user` (`user.id` → `guard.user.id`,
  `{ id: user.id, role: user.role }` → `guard.user`, etc.).
- If the handler passes a projection to a service
  (`getEventRegistrationState(... { id: user.id, role: user.role })`), pass
  `guard.user` or the projection off it as before — shape unchanged.
- Drop the `requireAuth` import when nothing else in the file still calls it.
  **Keep it** where a handler in the same file stays on `requireAuth` (soft read
  — see per-file notes).
- `getServiceClient()` calls stay; routes still reach DAOs/services.
- Do not reorder statements, touch validation, `loadEventOr403` calls, audit or
  `afterResponse` work. The auth branch is a mechanical find/replace.
- `requireRole()` takes no client, and `getServiceClient()` is the same singleton
  `requireAuth` would have used — no behavioural difference.

## Scope (all verified auth-only; the `.user` handler counterpart confirmed)

**Event leaf routes** — auth-only plus `loadEventOr403` (which throws its own
403/404) or ticket/survey logic:

| File                                                                | Handlers                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/app/api/events/[id]/register/route.ts`                         | GET, POST                                                                  |
| `src/app/api/events/[id]/route.ts`                                  | PATCH, DELETE — GET stays **soft** (`requireAuth` → `user?.role`), keep it |
| `src/app/api/events/[id]/meeting-link/route.ts`                     | PATCH                                                                      |
| `src/app/api/events/[id]/publish/route.ts`                          | POST                                                                       |
| `src/app/api/events/[id]/survey/route.ts`                           | GET                                                                        |
| `src/app/api/events/[id]/survey/send/route.ts`                      | POST                                                                       |
| `src/app/api/events/[id]/attendees/route.ts`                        | GET                                                                        |
| `src/app/api/events/[id]/attendees/manage/route.ts`                 | GET                                                                        |
| `src/app/api/events/[id]/attendees/[userId]/cancel/route.ts`        | POST                                                                       |
| `src/app/api/events/[id]/attendees/[userId]/checkin/route.ts`       | POST                                                                       |
| `src/app/api/events/[id]/attendees/[userId]/resend-ticket/route.ts` | POST                                                                       |
| `src/app/api/events/[id]/attendees/[userId]/survey/route.ts`        | POST                                                                       |
| `src/app/api/events/[id]/speakers/[profileId]/route.ts`             | DELETE                                                                     |

**QA** — `src/app/api/qa/message/[messageId]/route.ts` (GET, DELETE);
`src/app/api/qa/module/[moduleId]/route.ts` (GET, POST — the PATCH handler is
already `requireMinRole` + `guardFailure`, leave it).

**Auth mail** — `src/app/api/auth/email/send/route.ts` (POST),
`src/app/api/auth/email/cancel/route.ts` (POST).

> Naming notice: both already alias the user as `guard`
> (`const guard = await requireAuth(); if (!guard) 401`). After the change
> `guard` becomes the `AuthGuardResult`, so every `guard.email`, `guard.id`,
> `guard.full_name`, `guard.role` becomes `guard.user.email` etc.

**Payments** — `src/app/api/payments/route.ts` POST only (GET is already Pattern A).

## Tests

For each route in scope, find its test file (e.g. `rg -l "events/\[id\]/register/route" test`)
and swap the guard mock:

```ts
// from
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth: vi.fn() }));
// to
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole: vi.fn() }));
```

- Denial: `vi.mocked(requireRole).mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null })`
  and assert the handler returns 401 **and the DAO/service was never called**
  (this is the standing convention from `CHANGELOG` line 340).
- Success: `mockResolvedValue({ allowed: true, error: null, user: { id, role, … } })`;
  existing body assertions carry over unchanged — the handler output is identical,
  only the guard call underneath changed.
- Remove the `requireAuth` import from the test; add `requireRole` from
  `@/modules/auth/lib/role-guard`.

Existing test files already on the Pattern A recipe
(`vi.mock` of `role-guard` with `requireRole`) need no change; only assert their
mocks still line up after the route swap.

## Acceptance

- `rg -n "if \(!user\)" src/app/api --glob "route.ts"` shows **no** hits in the
  files above (remaining hits are soft reads: `events/route.ts`,
  `events/[id]/route.ts` GET, `community/route.ts`, `speakers/me/events/route.ts`,
  `storage/[bucket]/[...path]/route.ts`).
- Every converted handler names its result `guard` and reads `guard.user`.
- `test/api-auth-coverage.test.ts` stays green (regex matches `requireRole`).
- Coverage thresholds in `vitest.config.ts` are raised, never lowered.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
refactor: route every auth-only handler through requireRole()

The auth-only half of the dual guard pattern hand-rolled its 401 next to a
bare AuthUser | null. requireRole() admits any authenticated caller and
carries the narrowed user, so these handlers now refuse through guardFailure
like every other guard, leaving one refusal shape to audit.
```

No CHANGELOG entry (no wire behaviour change).
