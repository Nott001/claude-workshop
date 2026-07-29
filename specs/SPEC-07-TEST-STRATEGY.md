# SPEC-07 — Test Strategy

Status: active
Scope: what we test, how it runs in CI, and what is deliberately deferred.

## 1. Where we actually stand

Measured, not estimated:

| Signal                 | Baseline | Now       |
| ---------------------- | -------: | --------: |
| Test files             |       12 |    **21** |
| Tests                  |      169 |   **293** |
| Runtime (with coverage)|    ~3.3s |    ~6.0s  |
| **Statement coverage** |    2.25% | **7.22%** |
| Branch coverage        |    1.75% | **7.87%** |
| Source files touched   |       10 |    **20** |

The global percentage stays low because it is measured against all ~174 source
files, most of which are React components (see §3, P4). The number that matters
is *where* the coverage sits — the request-handling trust boundary is now
covered end to end:

| Coverage | File                                          |
| -------: | --------------------------------------------- |
|     100% | `app/api/events/route.ts`                     |
|     100% | `app/api/events/[id]/publish/route.ts`        |
|     100% | `app/api/storage/[bucket]/[...path]/route.ts` |
|     100% | `modules/auth/lib/role-guard.ts`              |
|     100% | `shared/db/dao/helpers.ts`                    |
|     100% | `modules/courses/lib/lesson-utils.ts`         |
|      97% | `app/api/events/[id]/register/route.ts`       |
|      96% | `app/api/checkin/route.ts`                    |
|      74% | `modules/auth/lib/session.ts`                 |
|      72% | `middleware.ts`                               |

### What the baseline suite was actually testing

Worth recording, because it is the trap to avoid repeating. The original 169
tests exercised only 10 files, because a large share of the assertions are
*type-shape tests* — they build an object literal inline and assert on that
literal:

```ts
// test/commerce.test.ts — passes even if every line of the payment module is deleted
const payment: Payment = { id: 1, status: "pending", /* ... */ };
expect(payment.status).toBe("pending");
```

That executes zero product code. TypeScript already guarantees the shape at
compile time; asserting it again at runtime buys nothing. These tests are not
harmful, but they must not be counted as coverage.

That executes zero product code. TypeScript already guarantees the shape at
compile time. Those tests are not harmful, but they must never be counted as
coverage — write tests that call the real function.

## 2. The pyramid

```
        /   E2E    \      deferred — see §6
       / Integration \    API routes + DAOs   <- built, §3
      /   Unit tests  \   guards, schemas, pure logic
```

## 3. What is covered, and what remains

### Done — API route handlers

Tested as integration tests against a mocked Supabase client: no live backend,
no browser, whole suite still under 6s. Each route covers the same four cases.

| Case            | Assert                                                  |
| --------------- | ------------------------------------------------------- |
| Unauthenticated | 401, **and no database call is issued**                 |
| Wrong role      | refused, and no write attempted                         |
| Invalid body    | 400 from the zod schema, with no partial write          |
| Happy path      | correct status, shape, and DAO call with correct scoping|

| Test file                    | Covers                                                |
| ---------------------------- | ----------------------------------------------------- |
| `api-checkin.test.ts`        | QR check-in: replay, cancelled, forged token, audit    |
| `api-event-register.test.ts` | ticket issuance, draft visibility, duplicate guard     |
| `api-events.test.ts`         | event create/publish, role gate, draft-only publish    |
| `api-storage.test.ts`        | object serving, 404 paths, and the gap below           |
| `api-auth-coverage.test.ts`  | **sweep: every route must have a guard**               |
| `auth-session.test.ts`       | `requireAuth`, `requireRole`, first sign-in provisioning|
| `middleware.test.ts`         | which routes are protected, and which are not          |
| `dao.test.ts`                | query shaping, user/event scoping, write failures      |
| `lesson-utils.test.ts`       | content type detection, url normalisation              |

The sweep in `api-auth-coverage.test.ts` is the highest-leverage of these: it
scans all 43 route files and fails if any lacks a `requireAuth`/`requireRole`
call. A new route shipped without a guard breaks the build rather than
shipping. Exceptions live in two explicit lists with stated reasons.

### Open finding — storage route has no authorization

`api/storage/[bucket]/[...path]` takes both the bucket and the object key from
the URL and reads with the **service client**, which bypasses row level
security. It performs no ownership check; the middleware only verifies that
*some* session exists. Any signed-in user can therefore read any object in any
bucket, and traversal-shaped segments pass through unsanitised.

This is pinned by tests under a `KNOWN GAP` heading so the behaviour is visible
and a fix registers as a deliberate change. It is listed in `KNOWN_UNGUARDED`
in the sweep. **Fix by resolving the object's owner and comparing to the caller,
or by issuing short-lived signed URLs instead of proxying the download.**

### Open finding — routes the middleware does not protect

`middleware.ts:5-9` guards only `/courses`, `/kiosk`, `/organization` and
`/api/*`. These are reachable with no session and rely on the page to gate its
own content: `/events/[id]/edit`, `/events/new`, `/events/[id]/speakers`,
`/payments`, `/tickets`, `/audit-logs`, `/speakers/dashboard`. Pinned in
`middleware.test.ts` under an explicit heading. Worth a deliberate decision on
whether page-level gating is sufficient.

### P2 — remaining DAO methods

`dao.test.ts` covers `helpers.ts` fully and the security-relevant parts of
`ticket.dao.ts`. The other 12 DAOs are untested. Same pattern applies: assert
that user/event scoping is never dropped from a query.

### P3 — remaining API routes

Roughly 38 of 43 routes still have no behavioural test, though all now pass the
guard sweep. Next by value: `api/payments/*` and `api/checkout` (money and
payment state transitions), `api/upload/*` (file type and size handling), then
`api/organization/*` and `api/audit-logs` (privileged reads).

### P4 — Components

`src/modules/*/components` are untested, and are most of the remaining
uncovered surface. Deliberately last: a broken button is visible in seconds, a
broken authorization check is not.

Note that the payment and ticket state machines (`canTransitionPayment`,
`canTransitionTicket`, `generateQrToken`) already have genuine behavioural
coverage in `commerce.test.ts`, including the illegal transitions.

## 4. Coverage targets

Thresholds in `vitest.config.ts` are a **ratchet against regression**, set just
under measured coverage — not an achievement:

| Metric     | Baseline |   Now | Floor | Target after P2/P3 |
| ---------- | -------: | ----: | ----: | -----------------: |
| Statements |    2.25% | 7.22% |    7% |                25% |
| Branches   |    1.75% | 7.87% |  7.5% |                20% |
| Functions  |    3.52% | 6.41% |    6% |                25% |
| Lines      |    2.36% | 7.42% |    7% |                25% |

Raise the floor in the same PR that raises actual coverage. Never lower it to
make a build pass.

Coverage counts *executed lines*, not *verified behaviour* — it is a gap
detector, not a quality score. A file at 100% with only type-shape assertions
is still untested, which is exactly how the baseline suite reached 169 tests
while touching 10 files.

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
