# 03. Prove the existing 00001–00021 migrations replay on a fresh stack

## Goal

Before squashing migration history, establish a known-good point: apply the
current `supabase/migrations/00001_initial_schema.sql` … `00021_password_reset_grants.sql`
exactly as they are today onto a clean local DB and confirm the schema that
results.

This is the reference the squash in sheet `04` is diffed against, and the
evidence that the un-squashed history is sound.

## Run order

After `02` (needs `config.toml` + a booted stack).

## Files touched

- `supabase/migrations/*` — **read only** this sheet.
- A throwaway dump file under `supabase/.temp/` (gitignored), e.g.
  `supabase/.temp/schema-before-squash.sql`.

## Prerequisites

- Sheets `01` + `02` complete; `pnpm db:start` succeeds.
- Docker daemon up.

## Steps

1. Ensure the local DB is pristine but seeded-nothing:
   `pnpm db:reset`.
   - At this point there is no `seed.sql` yet, so reset replays only the 21
     migrations. Confirm the command reports all files applied in order
     00001 → 00021.
2. Dump the resulting public schema (schema only — no data, no auth/storage
   schemas):

   ```bash
   pnpm exec supabase db dump --local --schema public -f supabase/.temp/schema-before-squash.sql
   ```

   Adjust flags per `supabase db dump --help` if this exact form errors — the
   intent is a schema-only dump of the `public` schema from the local DB.

3. Sanity-check the dump: it should contain the tables from the migrations
   (`"USER"`, `"EVENT"`, `"PAYMENT"`, `"TICKET"`, `"SURVEY"`, …), the
   `ENABLE ROW LEVEL SECURITY` table, the `GRANT ALL … TO service_role`
   line, and the `ALTER PUBLICATION supabase_realtime ADD TABLE …` statements.
4. Record the dump's hash for later comparison in sheet `05`:

   ```bash
   sha256sum supabase/.temp/schema-before-squash.sql
   ```

   Keep this value in the sheet's completion notes.

## Verification

- `pnpm db:reset` exits 0 and reports 21 migrations applied.
- `schema-before-squash.sql` exists and contains tables, RLS enables, the
  service_role grant and realtime publication membership.
- `pnpm test` still passes (the migration tests that pin file names in
  `test/migration-replay.test.ts` are still valid at this point).

## Risks / notes

- `00001` begins with `DROP SCHEMA public CASCADE`, which is fine on a fresh
  local stack but is exactly why pushing a squashed history to the remote is
  gated behind sheet `14`.
- Do **not** run `pnpm db:push` in this sheet: the remote DB mirrors 00001–00021
  already, and pushing identical files is a harmless no-op, but the risk of a
  stray run during the squash window is not worth it. Wait for sheet `14` if a
  remote push is ever genuinely wanted before then.
