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
the table). GoTrue's own mail — sign-up confirmations and email-change links —
always lands in inbucket → **Studio → inbucket** (or http://127.0.0.1:54324).

The project's own transactional mail — password-reset links, organization
invites, tickets, check-in receipts — is delivered by the app's SMTP seam, not
by GoTrue. When `.env` points at the local stack (`pnpm db:env local`), the
seam routes this mail to the same capture box GoTrue already uses, so it lands
in inbucket automatically — no SMTP configuration needed. Only a custom
capture port requires the block below in `.env` (the file `pnpm dev` reads;
`pnpm db:env` rewrites only the Supabase block, so it survives toggling):

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=54325
SMTP_USER=inbucket
SMTP_PASSWORD=inbucket
SMTP_FROM_EMAIL=no-reply@startuplab.center
```

inbucket does not authenticate, so any non-empty `SMTP_USER`/`SMTP_PASSWORD`
satisfies the config reader, and a loopback host defaults to plaintext, so no
`SMTP_SECURE` is needed. `SMTP_FROM_EMAIL` must be a real-shaped address: the
capture box rejects an envelope sender that is not — the default (inheriting
the username) sends `MAIL FROM:<inbucket>`, which answers `553`. Against the hosted project (`pnpm db:env remote`) the
seam must not mail a real relay from `next dev`, so it logs to the terminal
instead — and a reset still hands the link back on its own success screen.
Note the reverse: with the capture-box routing active but inbucket down, a
reset answers `delivery_failed` rather than falling back to the console,
because the seam is genuinely trying to mail.

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
file. Two named targets exist, and `pnpm db:env` points `.env` at one without
touching anything else in it:

```bash
pnpm db:env local   # point .env at the local stack (requires `pnpm db:start`)
pnpm db:env remote  # point .env at the hosted project, from the .env.remote overlay
```

`.env.remote` is an overlay you create by copying `.env.remote.example` and
filling in the hosted project's keys — `db:env` never generates it. A fresh
clone has neither `.env` nor `.env.remote`, so boot the stack, run
`pnpm db:env local`, and `dev` works; point at the hosted project later by
writing the overlay and running `pnpm db:env remote`.

`pnpm db:env` never prints secrets — it redacts the key lines in its diff.
`.env.example` documents the keys and placeholders. `SUPABASE_DB_PASSWORD`
(picked up by the Supabase CLI on a fresh `supabase start`) lives in this same
`.env`; `db:env` rewrites only the Supabase block, so it survives toggling.

Switching modes changes only the URL and the two keys; `pnpm dev` does not need
a restart, but a running dev server holds whatever `.env` was there at
startup, so restart it after toggling.

## Checking out the remote

`pnpm db:push` runs pending migrations against the remote. It targets the
_linked_ project, so a fresh clone must run `pnpm db:link` first — that needs a
Supabase login. Without one, pass the connection string directly:

```bash
supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
```

Which migrations run is decided by the remote's own tracking table
(`supabase_migrations.schema_migrations`), never by the state of your local
database — a `db:reset` beforehand changes nothing about what gets pushed. It is
still worth running one first as a rehearsal, because replaying from an empty
database is the only thing that proves a migration is sound from zero;
`supabase migration up` only ever runs it against a populated schema.

> **Always dry-run first.** `supabase db push --dry-run` prints exactly what
> would be applied and writes nothing. Read that list before every push against
> the remote — it is the one cheap check that catches a tracking table which has
> drifted out of step with the migration files.

The tracking table is rebased onto the post-squash baseline; it records
`00001`–`00006`, so a push applies only genuinely new migrations. An earlier
warning here said a push would see `00001_initial_schema.sql` as pending and
replay `DROP SCHEMA public CASCADE` against prod. That is no longer true, and
the dry run above will show it: verify rather than trust either claim.

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
  squash, or prod tracking out of sync. Run `pnpm db:reset` locally; for remote,
  dry-run the push first and compare against `supabase migration list`.
- **A column the code expects is missing** — the local DB is behind the
  migration files. `LESSON (*)` and other wildcard selects return the columns
  that exist rather than failing, so the gap surfaces as an `undefined` field far
  from its cause. Run `supabase migration list --local`; if it shows unapplied
  migrations, `supabase migration up --local` applies them without wiping data.
- **`pnpm db:env local` throws "did not report API_URL"** — the stack is down;
  run `pnpm db:start` first (the script reads `supabase status`).
- **Backup before destructive moves** — `pnpm db:reset` wipes local data. Stage
  or dump anything you need first; the seed restores the standard state.
