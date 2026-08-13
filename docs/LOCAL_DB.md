# Local database guide

Run the app against a local Supabase stack instead of the remote project. A new
contributor can go from clone to a running, seeded app with the commands below.

## Prerequisites

- A running Docker daemon (`docker info` succeeds). The local stack is a set of
  containers; without Docker there is no database.
- The `supabase` CLI installed (`supabase --version`). The project scripts call
  it directly, so it must be on your `PATH`.
- `pnpm install` already done.

## First boot

```bash
pnpm db:start    # pull + boot the local Supabase containers
pnpm db:reset    # wipe local data, replay migrations + seed (prompts for y/N)
pnpm db:env local # point .env at the local stack
pnpm dev         # start the app on http://localhost:3000
```

`pnpm db:reset` replays `supabase/migrations/` (the single squashed baseline
`00001_initial_schema.sql`) and then `supabase/seed.sql`. It prompts first so a
reset never nukes local data silently.

## Port map

| Service         | URL                        | Port  |
| --------------- | -------------------------- | ----- |
| API             | http://127.0.0.1:54321     | 54321 |
| DB              | postgres://127.0.0.1:54322 | 54322 |
| Studio          | http://127.0.0.1:54323     | 54323 |
| inbucket web UI | http://127.0.0.1:54324     | 54324 |

inbucket's **SMTP** inbound is port 54325; 54324 is only its web UI. Auth mail
is routed there by `supabase/config.toml`.

## Auth / email

`config.toml` mirrors prod: confirmations are **on** (`enable_confirmations =
true`), so a sign-up you perform locally is not usable until its email is
confirmed. There is no mail client — inbucket catches it.

Seeded users are **already confirmed**, so those logins work immediately (see
the table). For any other sign-up or a password-recovery flow, the confirm /
reset link lands in inbucket → **Studio → inbucket** (or http://127.0.0.1:54324).
Open the message, click the link (it carries `http://localhost:3000`), and the
app route completes the flow.

### Seeded logins

Shared password: `dev-password-123`. Emails are `@example.com` on purpose — they
are dev-only credentials and must never be real addresses.

| role          | email                     |
| ------------- | ------------------------- |
| `attendee`    | `attendee@example.com`    |
| `attendee`    | `attendee2@example.com`   |
| `facilitator` | `facilitator@example.com` |
| `speaker`     | `speaker@example.com`     |
| `admin`       | `admin@example.com`       |
| `super_admin` | `superadmin@example.com`  |

Note: `super_admin` signs in but the app then falls back to `attendee` — the
role is not in `INVITABLE_ROLES` (`src/modules/auth/lib/invited-role.ts`), so
`ensureUser` on sign-in cannot assert it. That mirrors prod and is intentional.
Use `admin@example.com` for admin flows.

The seed also creates ~16 **background** users (`USER` rows only, no
`auth.users` — see the seed header). They fill attendee lists, tickets,
payments, chat and survey responses so the app looks like prod, but they can
never sign in.

## Seed

`supabase/seed.sql` is idempotent: re-running `pnpm db:reset` yields the same
state, because every insert is `ON CONFLICT DO NOTHING` and sequences are
`setval()`ed past the seeded ids. One run is enough for a working app.

What a fresh reset leaves:

- 6 events: `Product Summit 2026` (active, 500 PHP) as the nearest upcoming, 2
  more upcoming (1 active AI/ML meetup, 1 draft meetup), and 3 past events
  (Rust Hack Night, Startup Weekend Manila, Design Systems Day) stored `active`
  with past end times — exactly how prod rows look, with `effectiveEventStatus`
  deriving them as `complete` on read.
- 2 courses (one per past/upcoming event; `COURSE.event_id` is UNIQUE) with 4
  modules and 7 lessons total.
- 3 speaker profiles with speaker assignments across events, and facilitator
  assignments on 3 events.
- 2 community links on the global `/community` page.
- Commerce across all events: paid + issued tickets, `checked_in` tickets
  (`checked_in_by`/`checked_in_at` on the event day), cancelled + refunded
  payments, and failed/pending stragglers. `attendee@example.com` still holds a
  paid ticket on the upcoming event and `attendee2@example.com` a pending
  payment (no ticket) — useful for exercising buy/resume flows.
- Surveys: an open one for the upcoming event (unsent, unsubmitted response for
  the ticketed attendee, inside the 14-day window) and closed ones for two past
  events with submitted responses (rating + comment) and one sent-but-unsubmitted
  recipient.
- Support cases with chat history (2 active, 2 ended), QA messages on courses,
  and staff invites in `pending`/`accepted`/`expired` states.
- Email and audit logs mirroring the ticket, check-in and survey activity.
- 4 storage buckets (`event_images`, `profile_images`, `course_assets`,
  `course_videos`) matching `src/shared/integrations/storage/policy.ts`.

## Env toggling

The app reads Supabase settings from `.env`, the single gitignored runtime env
file. Its sidecar snapshot `.env.remote` is gitignored too; a fresh clone has
neither, so create them via:

```bash
pnpm db:env local   # read local stack values (requires `pnpm db:start`), snapshot current file to .env.remote, rewrite .env
pnpm db:env remote  # restore the pre-local .env from the snapshot
```

`pnpm db:env` never prints secrets — it redacts the three key lines in its diff.
`.env.example` (committed) documents the keys and placeholders. `SUPABASE_DB_PASSWORD`
(picked up by the Supabase CLI on a fresh `supabase start`) lives in this same
`.env`; `db:env` rewrites only the Supabase key lines, so it survives toggling.

Switching modes changes only the URL and the two keys; `pnpm dev` does not need
a restart, but a running dev server holds whatever `.env` was there at
startup, so restart it after toggling.

## Checking out the remote

The remote project is linked (`pnpm db:link` sets the project ref). Pushing
schema changes with `pnpm db:push` runs pending migrations against the remote.

> **Warning — read before pushing.** After the migration squash, `pnpm db:push`
> is safe only once the remote's tracking table
> (`supabase_migrations.schema_migrations`) is rebased to the new baseline. Until
> that happens (sheet `14`), a push sees `00001_initial_schema.sql` as pending
> and would replay `DROP SCHEMA public CASCADE` against prod. Do not run
> `pnpm db:push` against the remote on this branch; future **numbered**
> migrations (00022+) are safe once the rebase lands.

## Troubleshooting

- **`docker info` fails** — the daemon is not running. Start Docker Desktop /
  the platform daemon, then `pnpm db:start` again.
- **Port conflicts** (`address already in use` from `pnpm db:start`) — the
  stack's ports (54321–54325) are taken. Free them or change the ports in
  `supabase/config.toml`, then restart.
- **Auth redirects to the wrong host** — `config.toml` sets `site_url =
http://localhost:3000` and its redirect allowlist; the app derives callback
  URLs from `NEXT_PUBLIC_APP_URL` (http://localhost:3000 locally). If you run
  the dev server on a different port/host, update both the env var and the
  redirect URLs before testing email links.
- **`22505` / `schema_migrations` errors** — a stale local DB from before the
  squash, or prod tracking out of sync. Run `pnpm db:reset` locally; for remote
  read the push warning above and see the rebase sheet `14`.
- **`pnpm db:env local` throws "did not report API_URL"** — the stack is down;
  run `pnpm db:start` first (the script reads `supabase status`).
- **Backup before destructive moves** — `pnpm db:reset` wipes local data. Stage
  or dump anything you need first; the seed restores the standard state.
