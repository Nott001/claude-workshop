# Local database environment — run spec

Each file in this directory is one spec sheet. They are **run sequentially**, in
filename order: `01` must be complete and verified before `02` starts, and so on.

Every sheet has the same shape: goal, run order, files touched, prerequisites,
steps, verification (definition of done) and risks. Do not skip the verification
section of a sheet — the next sheet depends on it.

| #   | Sheet                                                                           | What it produces                             |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| 01  | [`01-init-config.toml`](01-init-config.toml.md)                                 | `supabase/config.toml`                       |
| 02  | [`02-db-scripts`](02-db-scripts.md)                                             | `pnpm db:*` orchestration scripts            |
| 03  | [`03-prove-existing-migrations-replay`](03-prove-existing-migrations-replay.md) | Proof that 00001–00021 replay fresh          |
| 04  | [`04-squash-migration-baseline`](04-squash-migration-baseline.md)               | Single `00001_initial_schema.sql` baseline   |
| 05  | [`05-verify-baseline-fidelity`](05-verify-baseline-fidelity.md)                 | Byte-identical reset vs dump                 |
| 06  | [`06-seed-auth-users`](06-seed-auth-users.md)                                   | `supabase/seed.sql` auth + USER rows         |
| 07  | [`07-seed-content`](07-seed-content.md)                                         | `seed.sql` course / events / speakers        |
| 08  | [`08-seed-commerce`](08-seed-commerce.md)                                       | `seed.sql` payments / tickets                |
| 09  | [`09-seed-misc-and-buckets`](09-seed-misc-and-buckets.md)                       | `seed.sql` survey / settings / buckets       |
| 10  | [`10-reset-and-verify-seed`](10-reset-and-verify-seed.md)                       | Clean reset with a seeded, usable app        |
| 11  | [`11-wire-local-env`](11-wire-local-env.md)                                     | `pnpm db:env` · `.env.local` points at local |
| 12  | [`12-migration-tests`](12-migration-tests.md)                                   | Updated + new migration tests green          |
| 13  | [`13-docs`](13-docs.md)                                                         | `docs/LOCAL_DB.md`, README update            |
| 14  | [`14-prod-tracking-rebase`](14-prod-tracking-rebase.md)                         | One-time prod `schema_migrations` rebase     |

Sheets `01`–`13` are non-destructive. Sheet `14` rewrites the **prod** migration
tracking table and must only proceed after `13` is green and the repo owner has
explicitly approved this one sheet.
