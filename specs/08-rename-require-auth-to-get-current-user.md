# 08 — Rename `requireAuth` to `getCurrentUser`

## Run order

Eighth and last. Requires sheets 01 and 03–05 (they remove `requireAuth` from
every refused handler, leaving the census below small and stable).

## Motivation

After sheets 03–05 no refused handler calls `requireAuth` any more — every hard
refusal goes through `requireRole()`/`requireMinRole()` + `guardFailure`. The
only surviving call sites are soft reads ("who is signed in, or null") and the
hard guards' internals. The name no longer describes the function: it never
_requires_ anything and can never refuse. `getCurrentUser` says what it does —
resolve the current authenticated user, `null` when anonymous — in the same
voice as the adjacent `getCurrentUserId`.

`getCurrentUserId` keeps its name: it returns the raw Supabase auth id, not the
application user.

## Scope — the complete post-sheet census

`rg -l "requireAuth" src test` returns these and **only** these (run it to
confirm before starting):

**Library:**

- `src/modules/auth/lib/session.ts` — definition
- `src/modules/auth/lib/role-guard.ts` — import + two internal calls

**Soft-read routes (keep `AuthUser | null`):**

- `src/app/api/community/route.ts` (GET)
- `src/app/api/events/route.ts` (GET)
- `src/app/api/events/[id]/route.ts` (GET)
- `src/app/api/speakers/me/events/route.ts` (GET)
- `src/app/api/storage/[bucket]/[...path]/route.ts` (inside `resolveAccess`)

**Pages:**

- `src/app/user/page.tsx`
- `src/app/email-verified/page.tsx`

**Tests:**

- `test/auth-session.test.ts` — unit tests the function itself
- `test/role-guard.test.ts` — mocks `session`'s `requireAuth`
- `test/api-events.test.ts`, `test/api-event-detail.test.ts`,
  `test/api-community.test.ts`, `test/api-storage.test.ts` — mock the soft reads
- `test/user-settings-page.test.tsx`, `test/email-verified-page.test.tsx` — mock the page soft read
- `test/foundation.test.ts` — a **vestigial** mock (module is mocked but the
  value is never used); rename it for hygiene, nothing depends on it
- `test/api-auth-coverage.test.ts` — the guarded-route regex (see below)

## Changes

1. **`session.ts`**: rename the export and its JSDoc. Tighten the doc so it
   states intent: it never guards — it resolves the current authenticated user
   or `null`, and the hard guards in `role-guard.ts` sit on top of it.

2. **`role-guard.ts`**: `import { getCurrentUser }`; replace both `requireAuth()`
   calls in `requireMinRole` and `requireRole`.

3. **Five soft-read routes and two pages**: `const user = await requireAuth(...)`
   → `const user = await getCurrentUser(...)`; update imports. Behaviour is
   untouched (still `AuthUser | null`).

4. **`test/api-auth-coverage.test.ts`**: the guarded-route regex must grow a term —

   ```ts
   const guarded = (rel) =>
     /requireAuth|requireMinRole|requireRole|getCurrentUser/.test(readFileSync(path.join(API_DIR, rel), "utf8"));
   ```

   Without it, soft-read-only files (`speakers/me/events/route.ts`,
   `storage/[bucket]/[...path]/route.ts`) stop matching and the sweep fails.
   `PUBLIC_BY_DESIGN` stays unchanged.

5. **Tests** — a mechanical rename per file:
   - `auth-session.test.ts`: `import { getCurrentUser, getCurrentUserId }`, the
     `describe("requireAuth")` block → `describe("getCurrentUser")`, every
     `requireAuth(...)` → `getCurrentUser(...)`. The `getCurrentUserId` block
     and mocks stay.
   - `role-guard.test.ts`: mock factory `{ getCurrentUser: vi.fn() }`,
     `import { getCurrentUser }`, `vi.mocked(requireAuth)` → `vi.mocked(getCurrentUser)`.
   - Route/page tests listed above: same mock + call-site rename.
   - `foundation.test.ts`: `{ getCurrentUser: vi.fn() }` in the mock factory.
   - `api-auth-coverage.test.ts`: regex update in (4); the `PUBLIC_BY_DESIGN`
     body counts stay at 9.

## Acceptance

- `rg -l "requireAuth" src test` → 0 matches.
- `src` compiles with the new export name (no dangling imports).
- `api-auth-coverage` sweep green — soft reads match via `getCurrentUser`.
- Coverage thresholds raised, never lowered.

## Verification

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

## Commit

```
refactor: rename requireAuth to getCurrentUser

After the guard unification the function no longer refuses anything: every
hard denial goes through requireRole()/requireMinRole() and the survivors are
soft reads that resolve the current user or null. getCurrentUser says what it
does, next to the getCurrentUserId it pairs with.
```

No CHANGELOG entry (internal rename, no wire or API change).
