# CHANGELOG

## [Unreleased]

### Security

- Course material is no longer readable by any signed-in user. `/api/storage/[bucket]/[...path]` read any bucket and object key straight from the URL using the service client, bypassing row level security — paid course videos and assets were available to anyone with an account. Access now requires a live ticket to the event teaching the course, a speaker assignment to it, or the facilitator role.
- Storage requests are answered `Cache-Control: private`. Entitlement is per user, and the previous `public` response could be served from a shared cache to someone not entitled to it.

### Fixed

- Sessions survive a token refresh. The middleware rebuilt its response once per cookie, so each write discarded the one before it and the browser was left holding part of a chunked auth token — presenting as a random logout. Refusing a request no longer drops the cookies either, which is what cleared an expired session, so a stale token could previously fail the same way on every retry. Responses that carry a refreshed session are now marked uncacheable, since a shared cache could otherwise replay one visitor's session to the next.
- Deleting an event now deletes its course material. Asset and video paths were collected and then discarded: the single cleanup call only ever targeted the `event_images` bucket, so every deleted event left its uploads orphaned in storage.
- Attendee search returns matches again. The filter named embedded columns at the top level, which PostgREST does not apply, so searching a name or email quietly returned nothing. Search terms are now escaped as well — an underscore in an email address matched any character, and a comma silently split the filter.
- QR check-in works again. Every scan returned "Invalid QR token" because the ticket lookup joined the user through the wrong column, so the query errored and the ticket was reported as missing.
- Chat message senders, the event attendee list, and email log recipients load again — all four affected queries shared the same fault.
- Course pages load again. Three modules deleted during an earlier refactor left their importers behind, which broke the production build outright.
- The landing page shows the current events. It was prerendered at build time, so its "upcoming events" list was a snapshot taken at deploy: a newly published event never appeared and a finished one never left, until someone redeployed. It now renders per request. This also removes the build's dependency on a reachable database, which is what was failing the Build and Lighthouse jobs.

### Added

- Continuous integration. Four workflows run on every pull request: **CI** (format, lint, typecheck, unit tests with coverage, production build), **Security**, **Lighthouse**, and **E2E**. Each collapses into a single status check so branch protection needs no update when a job is added. The repository previously had no CI at all.
- Security scanning on every pull request and weekly on a schedule, so advisories against unchanged code still surface: CodeQL static analysis, gitleaks secret scanning over full history, a dependency audit that blocks on production advisories and reports dev-only ones, and a check that every table in a migration enables row level security.
- Lighthouse audits of the public routes (`/`, `/events`, `/sign-in`). Accessibility, best-practices, SEO and layout shift block on regression; performance and timing metrics warn, because they vary with CI runner load.
- **144 unit and integration tests** covering the request-handling trust boundary — the API routes, the session and role guards, the middleware's route protection, and DAO query shaping. Every route test asserts that an unauthorized request issues no database call at all, not merely that it returns 401.
- A sweep that reads all 43 API route files and fails if any lacks a `requireAuth` or `requireRole` call, so a route shipped without a guard breaks the build instead of shipping. Exceptions live in two explicit lists with written reasons.
- **41 end-to-end tests** driving a real browser against a real database: sign-in and route protection, the full purchase path from registration through ticket issuance to QR check-in, course material entitlement, event publishing, uploads read back through the entitlement gate, and course authoring. Each run provisions its own users, events and courses and deletes them afterwards, verified to leave the database exactly as it found it.
- Coverage measurement with thresholds set at measured values as a ratchet against regression. Statement coverage rose from 2.25% to 8.56%; the global figure stays low because components are most of the remaining surface, while the trust boundary itself is at or near full coverage.
- Dependabot, grouped so patch and minor updates arrive as one pull request and majors stay separate for review.
- Staff management pages for events, courses, emails, and organization under `src/app/staff/`.

### Changed

- Uploaded images are compressed with WebAssembly instead of sharp. sharp binds to libvips as a native Node addon, which cannot load in the V8 isolate Cloudflare Workers runs, so it blocked deployment there outright. Uploads whose longest edge exceeds 1600px are now scaled to fit, which is invisible at the sizes the app displays — covers render around 350px wide — and is where most of the saving comes from: a 3200px camera JPEG drops from 393KB to 51KB, against 162KB for the quality change alone. JPEGs are still re-encoded at quality 80 on top of that. PNGs within the cap are stored as uploaded, since re-encoding one at its original size returns identical bytes; sharp used to quantise their palette instead. **Originals are not retained**, so a full-resolution upload cannot be recovered later.
- Migrated from Clerk to Supabase Auth. All auth logic centralized in `src/modules/auth/`.
- Old staff-related pages moved under `src/app/staff/` namespace; route protection updated accordingly.
- All API routes updated: `auth()` from Clerk replaced with `requireAuth()`/`requireRole()` from auth module.
- All client components updated: `useUser()`/`useClerk()` replaced with `useSession()` from auth module.
- Middleware rewritten to use `@supabase/ssr` for session management.
- Staff login page merged into unified sign-in page (role-based redirect).
- `pnpm test` now runs once and exits; `pnpm test:watch` is the watch mode. `AGENTS.md` asks contributors to run the tests before committing, which previously dropped them into a watcher.
- `prettier`, `vitest` and `eslint-config-prettier` moved out of `dependencies`. They were shipping to production, and separating them is what lets the audit block on production advisories while treating dev-only ones as advisory.
- `postcss` and `sharp` pinned above their advisories through pnpm overrides, clearing three high-severity findings that reached production through `next`.
