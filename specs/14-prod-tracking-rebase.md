# 14. Rebase prod migration tracking to the squashed baseline

## Goal

Reconcile the **remote** database's migration-tracking table
(`supabase_migrations.schema_migrations`) with the new single baseline so that
future `pnpm db:push` runs are no-ops against what prod already has, instead of
replaying `DROP SCHEMA public CASCADE` and destroying prod.

The prod _schema_ is untouched by this sheet — only the bookkeeping table that
tracks "which migrations have been applied" is rewritten.

## Run order

Last. Requires sheets `01`–`13` complete and **explicit sign-off** from the repo
owner before running (per AGENTS.md: destructive migration changes — ask first).

## Files touched

- Remote DB only (`supabase_migrations.schema_migrations`). No repo files.

## Prerequisites

- Sheets `01`–`13` done; local baseline `00001_initial_schema.sql` is the sole
  migration file and matches prod's schema (verified in sheet `05` by
  construction — the local baseline came from the 00001–00021 replay, which is
  what prod has applied).
- Owner sign-off on the destructive step.
- Access to the remote project via `pnpm db:link` and a DB connection string.

## Steps

1. **Backup prod schema.** Before touching anything, take a schema-only dump:

   ```bash
   pnpm exec supabase db dump --linked --schema public -f /tmp/prod-schema-before-rebase.sql
   psql "$PROD_DB_URL" -c "SELECT * FROM supabase_migrations.schema_migrations;" > /tmp/prod-schema-migrations-before.txt
   ```

   Store both off-machine. Do not proceed if either fails.

2. **Confirm the diff is empty.** Dump prod's current `public` schema again and
   diff against the local baseline's replay. It must match (it is the source of
   the baseline). If not — stop, call a developer; the remotes diverged.

3. **Rewrite the tracking table.** Against the remote DB:

   ```sql
   BEGIN;
   DELETE FROM supabase_migrations.schema_migrations;
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('00001', '00001_initial_schema.sql');
   COMMIT;
   ```

   - `version` is the numeric prefix the CLI expects (check the exact format the
     remote table currently stores — `SELECT version FROM …` first and match it).
   - This makes prod think "00001_initial_schema.sql" is already applied.

4. **Verify push is a no-op:**

   ```bash
   pnpm exec supabase db push --dry-run
   ```

   It must report nothing to apply. Then (still safe) a real dry-run with the
   plan flag, never a real push, unless desired.

5. **Post-check the app**: run the remote `health`/landing endpoint and one
   staff read that touches a seeded-or-real row, to confirm the schema is intact.

## Verification

- Diff between `prod-schema-before-rebase.sql` (step 1) and the same dump
  _after_ step 4 is empty.
- `supabase db push --dry-run` says no pending migrations.
- No errors on the landing/prerendered page post-rebase.

## Risks / notes

- **This is the one irreversible step in the whole plan.** If a real push is
  ever run against prod before this sheet, `00001_initial_schema.sql` would
  execute `DROP SCHEMA public CASCADE` on the live database. That risk is why
  sheets `04`–`13` repeatedly warn against `pnpm db:push`.
- The `INSERT` value for `version` must byte-match what the CLI records;
  Supabase CLI versions write `version` as a bigint/text of the numeric prefix.
  Inspect the pre-table content in step 1 and mirror it.
- If the remote's tracking table lives in a different schema name
  (`supabase_migrations.*`), the DELETE/INSERT must target the real one found
  in step 1.
