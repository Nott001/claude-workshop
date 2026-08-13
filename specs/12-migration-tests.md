# 12. Update migration-related tests and add a static baseline guard

## Goal

Keep CI honest after the squash: update the two migration tests that currently
pin the pre-squash state (`migration-replay.test.ts`, `migration-grants.test.ts`)
and add one static test that proves the squashed baseline preserves the two
properties CI relies on — every created table enables RLS **in the same file**,
and the realtime publication membership survives.

## Run order

After `11` (needs the final baseline + seed in place; but runs independent of
the env wiring, so could be earlier/later as convenient).

## Files touched

- `test/migration-replay.test.ts` (update)
- `test/migration-grants.test.ts` (update)
- `test/migration-baseline.test.ts` (new)
- `AGENTS.md` if the testing conventions section should name the new suite —
  optional, keep out if unnecessary.

## Prerequisites

- Sheet `05` verified the baseline’s fidelity; `00001_initial_schema.sql` is
  the only file in `supabase/migrations/`.

## Steps

1. **`test/migration-replay.test.ts`**
   - Replace the pinned 21-element file list with the new expectation:
     exactly `["00001_initial_schema.sql"]`.
   - Keep (or adapt) the pure-replay assertions that still make sense against a
     single file: unique prefix, CRLF handling, and the dropped/kinesis
     statements that migrated into 00001 (e.g. `support_case_seq`,
     `DROP COLUMN event_id`, `support_type ENUM ('general')`).
   - Where an assertion tested a _change_ between two files (e.g. 00017
     removing an event branch), point it at the final state now embedded in
     the baseline instead.
2. **`test/migration-grants.test.ts`**
   - Update `BLANKET_GRANT_FILE` to the new final name (it is still
     `00001_initial_schema.sql`, so only the file-count/ordering assertions
     change) and the `files.length` floor (now 1) to match.
   - Keep the two meaningful checks: every table created **after** the blanket
     grant — which, with a single file, is every table — must be explicitly
     granted to `service_role`; and `PASSWORD_RESET_ATTEMPT` must not be exposed
     to `anon` or `authenticated`. That second check stays and is now a check of
     the baseline only.
3. **`test/migration-baseline.test.ts` (new)**
   - Read `supabase/migrations/00001_initial_schema.sql`.
   - Assert every `CREATE TABLE` name in the file has a matching
     `ENABLE ROW LEVEL SECURITY` statement in the same file (mirrors the CI
     `security.yml` check — this catches a future file split that renames the
     table before enabling RLS).
   - Assert the realtime publication statements from sheet `05` are all present.
   - Keep it a static sql-text test (no DB connection), matching the existing
     migration test style and running under vitest.
4. Run `pnpm test` — the entire suite must be green, including the new file.
5. Run `pnpm format`, `pnpm lint`, `pnpm typecheck`; fix anything they raise.

## Verification

- `pnpm test` green; `migration-baseline.test.ts` passes.
- `pnpm lint` / `pnpm typecheck` / `pnpm format` clean.
- CI `security.yml` RLS check would pass against the single file (its loop
  already iterates `supabase/migrations/*.sql`, so no workflow edit needed).

## Risks / notes

- Treat the migration tests as a ratchet, not a ceremony: they exist because a
  missing `service_role` grant broke prod invisibly (see the test comments).
- Don’t weaken the anon/authenticated non-exposure check on
  `PASSWORD_RESET_ATTEMPT` — it protects the password-reset rate limiter.
