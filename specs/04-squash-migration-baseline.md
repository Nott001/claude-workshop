# 04. Squash 00001–00021 into a single baseline migration

## Goal

Replace the 21 numbered migration files with one `00001_initial_schema.sql`
whose content is exactly the end-state schema of the old chain (proved in sheet
`03`), written in the same style as the original `00001`: a self-contained,
freshenable schema.

This is a **history rewrite**. It is intentionally destructive to migration
history. It is the direct consequence of the "Squash into a baseline" decision.

## Run order

After `03` (needs the pre-squash reference dump).

## Files touched

- `supabase/migrations/00001_initial_schema.sql` (replaced)
- `supabase/migrations/00002_*.sql` … `00021_password_reset_grants.sql` (deleted)

## Prerequisites

- Sheets `01`, `02`, `03` complete. `supabase/.temp/schema-before-squash.sql`
  exists.
- `do-not-commit/` understood: this sheet changes git-tracked files in
  `supabase/migrations/`. The remote DB is **not** touched by this sheet.

## Steps

1. Construct the new baseline. Source of truth is the pre-squash dump, not a
   hand-authored schema:

   - Take `supabase/.temp/schema-before-squash.sql` (the schema-only dump of the
     applied 00001–00021 chain) as the body.
   - Prepend the original prologue so `supabase db reset` stays idempotent:

     ```sql
     -- Sourced from the replay of the original 00001–00021 chain.
     DROP SCHEMA public CASCADE;
     CREATE SCHEMA public;

     GRANT ALL ON SCHEMA public TO postgres;
     GRANT ALL ON SCHEMA public TO anon;
     GRANT ALL ON SCHEMA public TO authenticated;
     GRANT ALL ON SCHEMA public TO service_role;
     ```

   - Append the realtime publication membership statements (whose exact form is
     in the original 00001):

     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE "LIVE_SESSION_STATE";
     ALTER PUBLICATION supabase_realtime ADD TABLE "CHAT_MESSAGE";
     ALTER PUBLICATION supabase_realtime ADD TABLE "SUPPORT_SESSION";
     ALTER PUBLICATION supabase_realtime ADD TABLE "TICKET";
     ```

     (Sheet `05` verifies this reconstruction byte-for-byte against a fresh
     replay, so the exact prologue/epilogue can be adjusted there if the diff
     shows drift.)

2. Write the result to `supabase/migrations/00001_initial_schema.sql`, replacing
   the original file.
3. Delete `00002_*.sql` through `00021_*.sql`.
4. Replay the new baseline on the local DB:
   `pnpm db:reset` (should apply exactly one migration).
5. Run `pnpm test` now — expect **known failures** in
   `test/migration-replay.test.ts` (it pins the old file list) and possibly
   `test/migration-grants.test.ts`. Do NOT fix them here; record the failures.
   Sheet `12` owns the test updates.

## Verification

- `git status` shows `00001_initial_schema.sql` modified and 00002–00021
  deleted; no other source files changed.
- `pnpm db:reset` applies exactly one migration and exits 0.
- The only test failures are the migration tests recorded in step 5.

## Risks / notes

- This sheet deletes tracked files. It is safe locally because the schema is
  reproducible from `schema-before-squash.sql`, but it must be the **last**
  local migration change before sheet `14` reconciles prod.
- Never run `pnpm db:push` between this sheet and sheet `14`: the remote still
  thinks 00001–00021 are applied, and pushing the new baseline would attempt
  `DROP SCHEMA public CASCADE` on prod.
- If the reconstructed baseline's diff in sheet `05` shows drift, fix the
  baseline _here_ (before anything depends on it) and re-run `db:reset`.
