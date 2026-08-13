# 02. Add local-DB orchestration scripts

## Goal

Expose the local stack and the remote push through `package.json` scripts so a
developer never has to know the raw Supabase CLI spellings.

## Run order

After `01` (needs `supabase/config.toml`).

## Files touched

- `package.json` (scripts block)
- No new source files in this sheet.

## Prerequisites

- Sheet `01` complete and verified.

## Steps

1. Add the following scripts to `package.json` (keep alphabetical ordering with
   existing scripts):

   ```jsonc
   "db:start": "supabase start",
   "db:stop": "supabase stop",
   "db:reset": "supabase db reset",
   "db:status": "supabase status",
   "db:link": "supabase link --project-ref aiyernsxamtgjebheekp",
   "db:push": "supabase db push"
   ```

2. Link the remote project now so subsequent sheets can use `supabase db push`
   to the correct target:
   - Run `pnpm db:link`.
   - It prompts for a database password / access token; use the existing remote
     project credentials. Nothing is pushed by `link` itself.
3. Run `pnpm db:start`, then `pnpm db:status` and confirm the API and DB URLs
   and the anon / service-role keys are printed. Note `db:reset` will be used by
   every later sheet — it wipes **local** data and replays migrations + seed.

## Verification

- `pnpm db:start` boots the stack; `pnpm db:status` prints a healthy table.
- `pnpm db:link` exits 0 and `supabase/config.toml` now carries nothing new
  (linking stores the ref in `supabase/.temp/project-ref`, gitignored).
- `package.json` scripts resolve without error:
  `pnpm run db:status`.

## Risks / notes

- `db:push` sends local **migration** state to the remote DB. Do not run it in
  this sheet — the remote tracking table is still on 00001–00021 and the
  squash has not happened yet. Pushing now is a no-op (no local files differ),
  but sheet `04` intentionally rewrites migration history, so workflow with the
  remote is gated until sheet `14`.
- Keep every script wrapped in `pnpm run`, never bare `supabase`, so PATH
  differences between shells are moot.
