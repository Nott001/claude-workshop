# SPEC-07 — Test Strategy

Status: active
Scope: what we test, how it runs in CI, and what is deliberately deferred.

## 1. Where we actually stand

Measured on `main`, not estimated:

| Signal                | Value                                              |
| --------------------- | -------------------------------------------------- |
| Test files            | 12 (`test/*.test.ts`)                              |
| Tests                 | 169, all passing                                   |
| Runtime               | ~1.8s (~3.3s with coverage)                        |
| **Statement coverage**| **2.25%** (72 / 3195)                              |
| Source files touched  | **10 of ~174**                                     |

The headline number to internalise: **169 passing tests exercise 10 source
files.** The suite is not as strong as its test count suggests.

The reason is that a large share of the assertions are *type-shape tests* —
they build an object literal inline and assert on that literal:

```ts
// test/commerce.test.ts — passes even if every line of the payment module is deleted
const payment: Payment = { id: 1, status: "pending", /* ... */ };
expect(payment.status).toBe("pending");
```

That executes zero product code. TypeScript already guarantees the shape at
compile time; asserting it again at runtime buys nothing. These tests are not
harmful, but they must not be counted as coverage.

The 10 files that genuinely are covered:

| Coverage | File                                    |
| -------: | --------------------------------------- |
|     100% | `src/modules/auth/lib/role-guard.ts`    |
|     100% | `src/modules/chat/lib/index.ts`         |
|     100% | `src/modules/commerce/index.ts`         |
|     100% | `src/modules/courses/lib/schemas.ts`    |
|     100% | `src/modules/kiosk/index.ts`            |
|     100% | `src/modules/notifications/index.ts`    |
|     100% | `src/shared/lib/date-utils.ts`          |
|      50% | `src/modules/events/lib/schemas.ts`     |
|      29% | `src/shared/integrations/storage/index.ts` |
|      14% | `src/shared/integrations/email/index.ts` |

These are the right things to have tested — pure logic, guards, schemas. The
problem is everything around them.

## 2. The pyramid we are aiming at

```
        /   E2E    \      deferred — see §6
       / Integration \    API routes + DAOs   <- the gap
      /   Unit tests  \   guards, schemas, pure logic  <- exists, thin
```

We are bottom-heavy in the wrong way: a thin base and nothing above it.

## 3. Priority gaps, highest value first

### P0 — API route handlers (43 routes, 0 tested)

Every route under `src/app/api/**/route.ts` is untested. These are the real
trust boundary: they parse untrusted input, enforce roles, and write to the
database. A bug here is a security bug, not a cosmetic one.

Test as integration tests with a mocked Supabase client — no live backend, no
browser, still milliseconds per test.

For each route, cover four cases:

| Case             | Assert                                                     |
| ---------------- | ---------------------------------------------------------- |
| Unauthenticated  | 401, and no database call is issued                        |
| Wrong role       | 403 (an attendee must not reach facilitator-only routes)    |
| Invalid body     | 400 from the zod schema, with no partial write             |
| Happy path       | correct status, correct shape, correct DAO call             |

Start with the routes where a failure costs the most:

1. `api/events/[id]/register` and `api/tickets/*` — ticket issuance
2. `api/payments/*` and `api/checkout` — money, and payment state transitions
3. `api/checkin` — QR check-in, the replay/forgery surface
4. `api/storage/[bucket]/[...path]` and `api/upload/*` — arbitrary file paths
5. `api/organization/*` and `api/audit-logs` — privileged reads

### P1 — Authorization logic

`role-guard.ts` is covered; `session.ts`, `ensure-user.ts` and `middleware.ts`
are not. `middleware.ts:5-9` is the single point deciding which routes are
public — worth a dedicated table-driven test over pathnames, including the
cases that look protected but are not (`/events/[id]/edit`, `/payments`,
`/tickets` are all reachable unauthenticated today).

### P2 — DAO layer (14 files, 0 tested)

`src/shared/db/dao/*` builds every query. Test the query-shaping logic against
a mocked client: correct filters applied, tenant/user scoping never omitted,
errors surfaced rather than swallowed.

### P3 — State machines and pure helpers

`canTransitionPayment` / `canTransitionTicket` are covered for the happy
transitions; extend to the illegal ones (refunded → paid, used → issued).
`generateQrToken` needs a collision/entropy assertion, not just a shape check.

### P4 — Components

`src/modules/*/components` are untested. Lower priority than the above: a
broken button is visible, a broken authorization check is not. Revisit after
P0–P2.

## 4. Coverage targets

Thresholds in `vitest.config.ts` are set at the **measured baseline**, as a
ratchet against regression — not as an achievement:

| Metric     | Now   | Floor | Target after P0 | Target after P2 |
| ---------- | ----: | ----: | --------------: | --------------: |
| Statements | 2.25% |    2% |             25% |             45% |
| Branches   | 1.75% |  1.5% |             20% |             40% |
| Functions  | 3.52% |    3% |             25% |             45% |
| Lines      | 2.36% |    2% |             25% |             45% |

Raise the floor in the same PR that raises actual coverage. Never lower it.

Coverage counts *executed lines*, not *verified behaviour* — it is a gap
detector, not a quality score. A file at 100% with only type-shape assertions
is still untested, which is exactly how we got here.

## 5. CI pipeline

Two workflows, each fanning out into parallel jobs, each collapsing into one
required status check (`CI` and `Security`) so branch protection needs no
change when a job is added.

**`.github/workflows/ci.yml`**

| Job       | Command            | Blocking |
| --------- | ------------------ | -------- |
| Format    | `pnpm format:check`| yes      |
| Lint      | `pnpm lint`        | yes      |
| Typecheck | `pnpm typecheck`   | yes      |
| Unit tests| `pnpm test:coverage`| yes     |
| Build     | `pnpm build`       | yes      |

Format/Lint/Typecheck run as a `fail-fast: false` matrix so one failure does
not mask the others. Coverage is written to the job summary and uploaded as an
artifact on every run, including failures.

**`.github/workflows/security.yml`**

| Job              | Tool                  | Blocking |
| ---------------- | --------------------- | -------- |
| CodeQL           | `security-extended`   | yes      |
| Dependency audit | `pnpm audit --prod`   | yes      |
| Dependency audit | `pnpm audit --dev`    | no (advisory) |
| Secret scan      | gitleaks, full history| yes      |
| RLS policy check | migration grep        | yes      |

Rationale for the split audit: a CVE in `eslint` never reaches a user, and
blocking on it teaches people to merge red. Production dependencies are gated
hard; dev advisories are reported and left to Dependabot.

The RLS check asserts that every `CREATE TABLE` in `supabase/migrations/*.sql`
is paired with `ENABLE ROW LEVEL SECURITY` in the same migration. RLS is what
stops one attendee reading another's tickets; a table added without it is a
silent, total bypass. All 22 current tables pass.

Supply-chain posture beyond the above: `--frozen-lockfile` everywhere,
`minimumReleaseAge` (24h cooling-off before a freshly-published version may
enter the lockfile), pinned `packageManager`, and grouped Dependabot PRs.

## 6. Deliberately deferred

**E2E (Playwright).** Not now. It needs a green build and a dedicated test
Supabase project with seeded fixtures; without isolation, E2E tests mutate
shared dev data, race each other, and fail for reasons unrelated to the PR.
Flaky E2E is worse than none — it erodes trust in the gates that do work.
Revisit with exactly one flow: register → pay → issue ticket → check in.

**Lighthouse.** Blocked on the build. When it lands, target only the routes
the middleware leaves public — `/`, `/events`, `/sign-in` — as a separate
non-blocking job. Note the middleware calls `supabase.auth.getUser()` on every
matched request, so numbers will be meaningless without real Supabase env.

## 7. Known-red gates on adoption

CI will be red on `main` the day it merges. This is the pipeline reporting
pre-existing breakage, not new breakage — no source file was modified.

- **Typecheck — 28 errors across 15 files.**
- **Build — fails**, on the same missing modules.

The root cause of the largest cluster: commit `6e58d0f` ("refactor: remove
stale module stubs") deleted three modules but left their importers in place.

| Missing module                            | Imported by                                                        |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `@/modules/courses/lib/lesson-utils`      | `use-course-create.ts:5`, `use-course-detail.ts:4`                  |
| `@/modules/courses/ui/lesson-dialog`      | `app/courses/new/page.tsx:9`                                        |
| `@/modules/courses/ui/curriculum-builder` | `app/courses/new/page.tsx:10`                                       |
| `./types`                                 | `modules/auth/components/session-context.tsx:6` — should be `../lib/types` |

The remainder are ordinary type errors: a `"outline"` Button variant that is
not in `ButtonVariant`, `null` assigned to `string` in three chat components,
missing `YT` namespace types in `youtube-player.tsx`, and a `@supabase/ssr`
cookie-options signature mismatch in `session.ts:22` and
`api/auth/callback/route.ts:20`.

All must be fixed before the pipeline is green, and before Lighthouse or E2E
become possible. Tracked separately from this spec.
