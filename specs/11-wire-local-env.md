# 11. Wire `.env.local` to the local stack

## Goal

Make the switch between remote and local Supabase one command, so `pnpm dev`
against the local stack is the default dev loop and reverting to prod is
trivial.

## Run order

After `10`.

## Files touched

- `.env.local` (gitignored, runtime) — **not** committed
- `.env.local.example` (new, committed, placeholder values only)
- `scripts/db-env.mjs` (new, committed)
- `.gitignore` (ensure `.env.local` / `.dev.vars` stay ignored)

## Prerequisites

- Sheet `10` complete; local stack running.
- Current `.env.local` has remote values (`NEXT_PUBLIC_SUPABASE_URL=…aiyernsxamtgjebheekp…`).

## Steps

1. Write `scripts/db-env.mjs` with two subcommands, reading current values from
   the live file and writing them back atomically (write-temp-then-rename):

   - `node scripts/db-env.mjs local`
     - Reads `supabase status` (or `supabase status -o env`) to fetch the local
       API URL (`http://127.0.0.1:54321`), anon key, and service-role key.
     - Rewrites these three `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY`
       values in `.env.local`. Swaps `NEXT_PUBLIC_APP_URL` to
       `http://localhost:3000`.
     - Prints the diff so a developer sees exactly what changed, and refuses if
       any of the three local values is missing.
   - `node scripts/db-env.mjs remote`
     - Restores the production values from saved state.
   - Save the prior values (a backup line in the file, or a sidecar
     `.env.remote` copy) so `local` ↔ `remote` is togglable without re-typing
     credentials.

2. Add a `db:env` script to `package.json`:
   `"db:env": "node scripts/db-env.mjs"`.
3. Commit `.env.local.example` with placeholders and a comment that real values
   are produced by `pnpm db:env`, never entered by hand.
4. Verify the local value of `NEXT_PUBLIC_SUPABASE_URL` actually matches the
   local API port from sheet `01` (54321).

## Verification

- `pnpm db:env local`, then `pnpm dev` → app renders seeded data (no remote
  dependency for the Supabase calls).
- `pnpm db:env remote` restores the exact original file values
  (`diff` against the sidecar copy is empty).
- Re-running `local` twice in a row is stable (idempotent).

## Risks / notes

- Never write anon/service-role keys to a committed file; anything committed is
  placeholders only.
- The local service-role key is what the app's DAOs use; without it local
  `NEXT_PUBLIC_*` URLs break the service client.
- Do not switch `NEXT_PUBLIC_APP_URL` to the ngrok value in the local case —
  sheet `11` fixes that regression (the browser must build checkout URLs the
  same origin as the dev server).
- If `.env.local` becomes corrupted, regeneration is: `git restore` the example,
  then `pnpm db:env local`.
