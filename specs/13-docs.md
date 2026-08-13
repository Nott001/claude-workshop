# 13. Documentation — local database guide

## Goal

Document the local database environment so a new contributor can go from clone
→ running app against a local DB without asking anyone, and knows how the
remote push works once this whole change lands.

## Run order

After `12` (all behavior is in place; this sheet only writes).

## Files touched

- `docs/LOCAL_DB.md` (new)
- `README.md` (linking + minimal Getting-Started update)

## Prerequisites

- Sheets `01`–`12` all verified.

## Steps

1. Write `docs/LOCAL_DB.md` covering, in order:
   - **Prereqs**: Docker daemon running, `supabase` CLI installed.
   - **First boot**: `pnpm db:start`, `pnpm db:reset`,
     `pnpm db:env local`, `pnpm dev`.
   - **Port map**: API 54321, DB 54322, Studio 54323, inbucket 54324.
   - **Auth / email**: confirmations on mirror prod; seeded users are
     pre-confirmed; recovery/confirm links appear in Studio → inbucket.
     Include the seeded logins table (roles → emails) from sheet `06`.
   - **Seed**: what exists (1 course, 2 events, paid ticket, survey, 4 buckets)
     and the idempotence note (`pnpm db:reset` → deterministic state).
   - **Env toggling**: `pnpm db:env local` / `remote`, and that
     `.env.local` / `.env.local.example` are not committed.
   - **Checking out the remote**: `pnpm db:link` + `pnpm db:push`, with the
     explicit warning from sheet `14`: after a squash, pushing is only safe once
     the remote tracking table is rebased.
   - **Troubleshooting**: `docker info` failure, port conflicts, auth
     redirect-url mismatches, "22505 / schema_migrations" errors after squash
     (→ see sheet `14`).
2. Update `README.md` Getting Started to name the two commands and link
   `docs/LOCAL_DB.md` (keep it short; the detail lives there).
3. Run `pnpm format` (`docs/*.md` is covered by prettier) and confirm no lint
   impact.

## Verification

- A fresh contributor following `docs/LOCAL_DB.md` end-to-end reaches a running
  app with seeded data (the sheet-10 scenario) — perform this check once.
- `README.md` contains a working link to `docs/LOCAL_DB.md`.
- `pnpm format:check` is clean.

## Risks / notes

- Never document the real remote keys or passwords — reference `pnpm db:env`
  instead.
- Mention explicitly that `pnpm db:push` is currently safe for future numbered
  migrations, and that the reboot of prod tracking happens once in sheet `14`.
