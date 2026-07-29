# SPEC-07 — Test Strategy

Status: active
Scope: what we test, how it runs in CI, and what is deliberately deferred.

## 1. Where we actually stand

Measured, not estimated:

| Signal                 | Baseline | Now       |
| ---------------------- | -------: | --------: |
| Test files             |       12 |    **23** |
| Tests                  |      169 |   **322** |
| Runtime (with coverage)|    ~3.3s |    ~6.5s  |
| **Statement coverage** |    2.25% | **8.56%** |
| Branch coverage        |    1.75% | **9.41%** |
| Source files touched   |       10 |    **20+**|

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
compile time. Those tests are not harmful, but they must never be counted as
coverage — write tests that call the real function.

## 2. The pyramid

```
        /   E2E    \      real browser + real database  <- built, §8
       / Integration \    API routes + DAOs             <- built, §3
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
| `api-storage.test.ts`        | bucket allowlist, path safety, course entitlement     |
| `api-auth-coverage.test.ts`  | **sweep: every route must have a guard**               |
| `auth-session.test.ts`       | `requireAuth`, `requireRole`, first sign-in provisioning|
| `middleware.test.ts`         | which routes are protected, and which are not          |
| `dao.test.ts`                | query shaping, user/event scoping, write failures      |
| `lesson-utils.test.ts`       | content type detection, url normalisation              |

The sweep in `api-auth-coverage.test.ts` is the highest-leverage of these: it
scans all 43 route files and fails if any lacks a `requireAuth`/`requireRole`
call. A new route shipped without a guard breaks the build rather than
shipping. Exceptions live in two explicit lists with stated reasons.

### Resolved — storage route authorization

`api/storage/[bucket]/[...path]` previously took both the bucket and the object
key from the URL and read with the service client, bypassing row level
security. Any signed-in user could read any object in any bucket, including
paid course video and asset material, and traversal-shaped segments passed
through unsanitised.

Now enforced in three layers:

1. **Bucket allowlist** — only the four buckets in `STORAGE_BUCKETS` are
   served. An unknown bucket never reaches storage, so it cannot be probed.
2. **Path validation** — empty, `.`, `..`, backslash and null segments are
   rejected before the key is assembled.
3. **Entitlement** — course buckets require a live ticket to an event teaching
   that course, or a speaker assignment to one (`courseDao.userHasCourseAccess`).
   Facilitators bypass. Other buckets require only a session.

Every refusal returns an identical 404, so a caller cannot distinguish a
missing object from a forbidden one and use the endpoint to enumerate uploads.
Responses are `Cache-Control: private`, since entitlement is per-user and a
shared cache must not serve one user's material to another.

Covered by 31 tests in `api-storage.test.ts`.

### Open finding — event covers unreachable when logged out

`middleware.ts` protects all of `/api/*` except `/api/auth`, which includes
`/api/storage/*`. Event cover images are stored as `/api/storage/event_images/…`
by `uploadToStorage`, so they require a session — but `/events` is a public
page. Logged-out visitors get broken images on the public event listing.

Not a security issue; the opposite. Fixing it means either exempting
`event_images` in the middleware or serving covers as signed URLs. Left alone
here because it changes the middleware's contract, which deserves its own
decision.

### Open finding — routes the middleware does not protect

`middleware.ts` guards `/staff` and `/api/*`. The route restructure moved the
privileged pages under `/staff`, which closed most of this — `/audit-logs`,
`/events/new` and the event edit pages are now covered.

Still reachable with no session, relying on the page to gate its own content:
`/events/[id]/edit`, `/payments`, `/tickets`, `/speakers/dashboard`. All four
still exist as pages at those paths. Pinned in `middleware.test.ts` under an
explicit heading. Worth deciding whether these are leftovers from the
restructure or intentionally page-gated.

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
| Statements |    2.25% | 8.56% |  8.5% |                25% |
| Branches   |    1.75% | 9.41% |    9% |                20% |
| Functions  |    3.52% | 7.58% |    7% |                25% |
| Lines      |    2.36% | 8.45% |  8.4% |                25% |

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

## 6. Previously deferred, now built

Both items in this section were deferred for stated reasons. Both reasons went
away, and the record of why is kept because the reasoning was sound at the time.

**E2E (Playwright).** Deferred on the grounds that it needed a green build and
an isolated database. The build was fixed, and the isolation concern turned out
to be answerable another way — see §8. Now 5 tests, ~11s.

**Lighthouse.** Deferred because it needs `pnpm start`, which needs build
output that did not exist. Now runs against `/`, `/events` and `/sign-in`, the
routes the middleware leaves public.

## 7. Adoption history

The pipeline was red on arrival: 24 pre-existing TypeScript errors and a build
that failed on three modules deleted by an earlier refactor while their
importers were left behind. That was the pipeline reporting existing breakage
rather than introducing any — no source file changed when it landed.

All of it is now fixed and every gate passes.

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

## 8. E2E (added)

Playwright, in `e2e/`, deliberately outside `test/` so `pnpm test` stays a fast
hermetic vitest run. These talk to a real browser and a real database.

`pnpm test:e2e` — 22 tests across 4 specs, ~60s locally. One is marked
`fixme`; see §9.

### Why this became viable

The earlier objection was that E2E against the shared dev Supabase would mutate
real data and fail on the second run, since `register` returns 409 once a user
holds a ticket. Three things resolved it:

- The dev database is effectively empty — 4 users, no events, tickets or
  courses — so there is almost nothing to pollute.
- The service role key permits `auth.admin.createUser`, so each run provisions
  its own accounts rather than reusing one.
- `SimulatedPaymentGateway` marks payment paid and issues a real ticket with no
  external gateway, so the full purchase flow is reachable in a test.

### The fixture contract

`e2e/fixtures.ts` creates every user and event a run needs, prefixed `e2e-`,
and deletes them afterwards — children first, so foreign keys allow it.
Verified: 4 users before a run, 4 after, zero orphans.

Two details that matter:

- `email_confirm: true` on user creation. A user made through the normal
  sign-up flow may need to confirm an email, which a test cannot do.
- The role is written straight into the `USER` row, because `ensure-user`
  hardcodes every new user to `attendee` and there is no path to facilitator
  through the application.

Cleanup logs rather than throws. A teardown failure must not turn a passing
test red, and the `e2e-` prefix makes orphans from a crashed run sweepable.

### CI

`.github/workflows/e2e.yml` needs three repository secrets:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. It skips on fork pull requests, which cannot
receive secrets — skipping is honest where failing would be noise.

**The service role key in CI is a real exposure.** It bypasses row level
security entirely. The alternative is a dedicated Supabase project for testing,
which is the right move if this repo ever takes outside contributions.

### What is covered

| Spec | Covers |
| --- | --- |
| `auth.spec.ts` | session, staff redirect, bad credentials, role boundary |
| `tickets.spec.ts` | buy → ticket issued → QR check-in, replay, forged token, role gate |
| `entitlement.spec.ts` | course material access with/without ticket, cancelled ticket, bucket and path refusal |
| `events.spec.ts` | draft visibility, publish, republish refusal, role gate |

Cleanup is verified rather than assumed: the database returns to exactly its
baseline after a full run — 4 users, no events, courses, tickets or objects.

## 9. Findings from the first E2E run

Three defects surfaced within minutes of running against a real database. All
322 unit tests were green throughout, which is the argument for E2E in one
paragraph: a mock returns whatever the test tells it to, so a query that cannot
run still passes.

### Fixed — broken embed in eight queries

Four DAOs asked PostgREST to embed the user via `USER:id(...)`, which joins
through the row's own primary key rather than its foreign key. No such
relationship exists, so the query errored, `.single()` returned null, and the
caller treated it as "not found".

**QR check-in was completely broken in production** — every scan returned
"Invalid QR token". Chat messages, the attendee list and email logs were
affected by the same mistake.

Corrected to `USER:user_id(...)` in `ticket.dao.ts` (×2), `chat-message.dao.ts`
(×4) and `email.dao.ts` (×2), and each corrected query verified against the
live database.

### Fixed — entitlement query written against the wrong schema

`userHasCourseAccess`, added the same day, joined on `EVENT.course_id`. That
column does not exist. Both joins errored, the function returned false, and
course material was denied to everyone except facilitators — a fix that failed
closed, with every unit test green because they stub the function outright.

Now follows the live schema. Verified by `entitlement.spec.ts`: an attendee
holding a ticket gets 200, one without gets 404.

### Open — the migration file does not match the database

The live schema and `00001_initial_schema.sql` disagree about how courses and
events relate:

| | Migration file | Live database |
| --- | --- | --- |
| Link | `EVENT.course_id → COURSE` | `COURSE.event_id → EVENT` |

`EVENT.course_id` does not exist. Consequences reaching beyond the tests:

- **Event creation through the API always fails.** `api/events/route.ts:52`
  writes `course_id` on every insert, and the column is absent. This is why the
  database contains no events at all — not a fresh project, a broken endpoint.
  Recorded as a `fixme` test in `events.spec.ts`.
- `api/events/[id]/route.ts` reads `event.course_id` when deleting course
  assets, so that cleanup path cannot work either.
- `AUDIT_LOG` uses `actor_id`, not `user_id` — matching the migration, but worth
  noting since the fixtures got it wrong first.

Resolving this is a schema decision, not a test one. Either add `course_id` to
`EVENT` in a new migration and change the COURSE side, or keep the live shape
and change the routes to match. Either way the migration file should describe
what actually exists — `AGENTS.md` forbids editing an applied migration, so
this wants a new numbered one.

Until then, `userHasCourseAccess` and the E2E fixtures follow the database,
because that is what the queries run against.
