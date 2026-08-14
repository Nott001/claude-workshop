# 03. Harden the schema for browser realtime

## Goal

The Q/A panel will lean on browser realtime from sheet 05. `postgres_changes`
delivery requires the caller's role to read the row and the table to be a
member of the `supabase_realtime` publication. The browser client carries the
signed-in session, so the role is `authenticated` — not `anon` (an anon grant
would be a security hole: anonymous clients cannot be scoped to an event in a
policy). This sheet ships a new, additive migration that idempotently re-asserts
the grant, publication membership and RLS policy.

## Run order

Third, and MUST complete before 05 (the panel's realtime switch depends on it).

## Files touched

- Create `supabase/migrations/00003_qa_realtime.sql`
- `test/migration-replay.test.ts` — expected-file list gains the new file
- `test/migration-baseline.test.ts` — no change unless it pins file count

## Prerequisites

- Sheet 02 verified; migration chain currently exactly
  `["00001_initial_schema.sql", "00002_lesson_name.sql"]` per
  `test/migration-replay.test.ts`.

## Steps

1. Author `00003_qa_realtime.sql`:
   - `GRANT SELECT ON TABLE "public"."QA_MESSAGE" TO "authenticated";`
     (idempotent).
   - A guarded `DO` block that adds `QA_MESSAGE` to `supabase_realtime` only
     if not already present (`pg_publication` ⋈ `pg_publication_rel` ⋈
     `pg_class`).
   - A guarded `DO` block that creates the `authenticated` SELECT policy
     `"Users read Q&A messages for their modules"` only if absent
     (`pg_policies`), reusing the exact event-membership `USING` clause from
     00001 so behaviour is unchanged.
2. Never edit `00001` or `00002`.
3. Update `test/migration-replay.test.ts`:
   `expect(migrations).toEqual(["00001_initial_schema.sql", "00002_lesson_name.sql", "00003_qa_realtime.sql"])`
   and any count assertions.
4. If a local Supabase stack is up, replay the chain per `docs/LOCAL_DB.md`
   and confirm the migration applies cleanly and its guards hold on re-run.

## Verification

- `pnpm test` passes (migration replay + RLS-baseline checks).
- `rg "ALTER PUBLICATION supabase_realtime ADD TABLE.*QA_MESSAGE" supabase/migrations` matches only 00001 and (as a guarded statement) 00003.
- All statements in `00003` are idempotent-first (guarded).

## Risks

- Re-assertion migrations can blur into no-ops if the baseline already covers
  everything; they are still shipped because the panel's runtime behaviour now
  depends on these guarantees and environments can drift.
- `CREATE POLICY` has no `IF NOT EXISTS`; only the `pg_policies` guard keeps it
  replay-safe. Keep that guard, do not emit a bare `CREATE POLICY`.
