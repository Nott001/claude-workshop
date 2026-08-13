# 05. Verify baseline replay fidelity

## Goal

Prove the squashed baseline reproduces exactly the schema the 00001–00021 chain
produced in sheet `03` — that squashing lost nothing and added nothing.

## Run order

After `04`.

## Files touched

- None (read/compare only). A scratch dump goes to `supabase/.temp/`.

## Prerequisites

- Sheets `03` (pre-squash reference) and `04` (new baseline) complete.

## Steps

1. On the already-reset local DB, dump the public schema again:

   ```bash
   pnpm exec supabase db dump --local --schema public -f supabase/.temp/schema-after-squash.sql
   ```

2. Diff the two dumps:

   ```bash
   diff supabase/.temp/schema-before-squash.sql supabase/.temp/schema-after-squash.sql
   ```

3. Interpret the diff. Accept only differences that are caused by the dump tool
   itself (ordering, quoting) — every table, column, type, grant, RLS policy and
   realtime publication membership must be identical.

4. Re-run the hash comparison recorded in sheet `03`:

   ```bash
   sha256sum supabase/.temp/schema-before-squash.sql supabase/.temp/schema-after-squash.sql
   ```

   If hashes differ, review the `diff` narrowly before declaring success.

5. Double-check the policy surface that the security workflow will scan later:
   both dumps must enable RLS on every table the baseline creates, in the same
   file (the baseline is one file, so this is the whole schema).

## Verification

- `diff` between the two schema dumps shows no semantic drift.
- Every table created in `00001_initial_schema.sql` has an
  `ENABLE ROW LEVEL SECURITY` counterpart in the same file.
- `GRANT ALL … TO service_role`, the anon/authenticated grants, and the
  realtime publication membership from sheet `03` are all still present.

## Risks / notes

- This is the anti-regression gate for the whole squash. If it shows drift, stop
  and fix sheet `04` before proceeding — later sheets assume this schema is
  correct.
- `supabase db dump` output ordering can legitimately differ between runs; the
  semantic diff is what matters, not byte equality.
