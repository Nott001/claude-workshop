# 10. Reset and verify the fully seeded local stack

## Goal

Prove the whole stack — baseline migration + complete seed — boots and behaves
like prod-on-localhost: tables, grants, and seed data all present; a seeded user
can actually sign in.

## Run order

After `09`.

## Files touched

- None required. If a fix is needed it lands back in `seed.sql` or
  `00001_initial_schema.sql`, then this sheet re-runs.

## Prerequisites

- Sheets `01`–`09` complete.

## Steps

1. Re-run the reset to prove end-to-end determinism:
   `pnpm db:reset` (migrations then seed, no errors).
2. Verify the database angle:

   ```bash
   pnpm exec supabase db dump --local --schema public -f /dev/null   # parses cleanly
   ```

   plus targeted queries (via `psql` in the container or `supabase` SQL) for:
   - `USER` has rows for every role from sheet `06`
   - one paid ticket + one pending payment per sheet `08`
   - exactly the four storage buckets from sheet `09`
   - `00001_initial_schema.sql` produced the expected migration count in the
     applied-migrations table (`supabase_migrations.schema_migrations`).

3. Verify the behavior angle — seeded auth user can sign in:
   - Start the app (`pnpm dev`) with `.env.local` pointed at the local stack
     (use sheet `11`'s `db:env` first if not yet done).
   - Sign in as `attendee@example.com` and confirm the session persists and the
     tickets/registration pages render seeded data.
   - (Optional but recommended) open one confirmation/recovery link from
     Supabase Studio's inbucket (port 54324) to confirm auth mails work.
4. Confirm storage works: upload an image file through the profile-photo or
   event-cover flow and see it land in the local `storage.objects` table.

## Verification

- `pnpm db:reset` re-runs cleanly twice in a row (idempotence).
- Seeded users sign in; `session` cookie is set.
- The tickets page shows the paid ticket; the event register page shows the
  active seeded event.
- Upload lands in local storage and the image URL is servable.

## Risks / notes

- This is the sheet that couples the **app** (dev server) to the local DB for
  the first time. Expect at least one integration hiccup (CORS/origin, auth
  URL allowlist) — fix root causes here, not in later sheets.
- Any change to `seed.sql` or the baseline must be followed by a re-run of this
  sheet, not sheet `04`/`05` alone.
