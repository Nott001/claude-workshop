# 06. Seed — auth users and public USER rows

## Goal

Create `supabase/seed.sql` and, in it, the authentication side of the seed:
pre-confirmed GoTrue users across every app role, each linked to a `public.USER`
row via `auth_user_id`.

Seeds must be **idempotent** — re-running them via `pnpm db:reset` must produce
the same state.

## Run order

After `05` (needs the corrected baseline).

## Files touched

- `supabase/seed.sql` (new)
- `supabase/config.toml` (no change expected, but confirm `enable_confirmations`
  is still `true` from sheet `01`)

## Prerequisites

- Sheets `01`–`05` complete; baseline verified.
- Decisions: auth mirrors prod (confirmations on, seeded users pre-confirmed).

## Steps

1. Create `supabase/seed.sql` with a header comment noting it is replayed by
   `supabase db reset` after migrations — ordering matters.
2. Seed one user per role, all pre-confirmed (`email_confirmed_at` set), so the
   app's email flow is not a blocker locally:

   | role          | email                     | notes                         |
   | ------------- | ------------------------- | ----------------------------- |
   | `attendee`    | `attendee@example.com`    | two of these                  |
   | `facilitator` | `facilitator@example.com` |                               |
   | `speaker`     | `speaker@example.com`     |                               |
   | `admin`       | `admin@example.com`       | also `super_admin`? see steps |

   Get the exact role names from `src/shared/lib/roles.ts`; keep them in sync.

3. Insert GoTrue users into `auth.users` (schema from a fresh Supabase stack —
   columns like `instance_id`, `aud`, `role`, `raw_app_meta_data`,
   `raw_user_meta_data`, `email`, `encrypted_password`, `email_confirmed_at`).
   Use fixed UUIDs so inserts are idempotent.
   - Passwords via pgcrypto: `crypt('a-dev-only-password', gen_salt('bf'))`.
     Note pgcrypto is installed by the Supabase stack; if not, `CREATE EXTENSION`
     it first. Keep passwords distinctive in a comment — they are dev-only.
4. Insert matching rows into `public."USER"` linking `auth_user_id` to the UUIDs
   above, with `full_name` and `role` matching.
5. Make every insert idempotent: `ON CONFLICT DO NOTHING` on the natural unique
   key (`email` / `auth_user_id`), or `DELETE` + re-insert guarded by a
   `DO $$` block. Choose one approach and stay consistent across sheets 06–09.
6. Do not reference `id` values that the app's service role would produce — the
   app upserts `USER` rows from auth (`ensure-user`), so a re-checked-in user may
   collide with a seeded one. Prefer emails that are clearly seed-scoped
   (`…@example.com`).

## Verification

- `pnpm db:reset` applies the baseline and the seed without error.
- `SELECT role, count(*) FROM "USER" GROUP BY role;` shows at least one row per
  role from the steps table.
- Each seeded `auth.users` row has `email_confirmed_at IS NOT NULL` and the
  matching `"USER"` row's `auth_user_id` equals that auth user's `id`.
- Re-running `pnpm db:reset` again yields identical counts (idempotence).

## Risks / notes

- `auth.users` is an internal table; do not invent columns. Read its schema on
  the local stack (`\d auth.users` via `psql`) before writing inserts.
- Local auth mimics prod: with `enable_confirmations = true`, any user _not_
  seeded with `email_confirmed_at` cannot sign in — that is intentional.
- Never commit a real password as one of these hashes; they are dev-only
  credentials gated behind `@example.com` addresses.
