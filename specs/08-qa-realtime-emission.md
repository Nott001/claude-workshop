# 08. Fix QA_MESSAGE realtime delivery under authenticated

## Goal

QA_MESSAGE realtime emission is dead: the SELECT policy "Users read Q&A
messages for their modules" is a correlated subquery that reads TICKET, and
the browser-facing `authenticated` role has neither a SELECT grant nor a SELECT
policy on `TICKET`. Evaluating the policy under that role raises `42501`, so
Supabase Realtime emits nothing for QA_MESSAGE — a new question appears for
nobody, sender or staff, until a page refresh. REST lists still work because
the app reads server-side with the `service_role` client (BYPASSRLS), which is
why the breakage stayed invisible. Chat is unaffected: its policy only reads
`USER`, reachable through the SECURITY DEFINER `conversation_participant`.

Fix by routing the visibility check through a SECURITY DEFINER helper — the
same seam `conversation_participant` already is — so it evaluates as the
function owner without widening grants on `TICKET`.

## Run order

Eighth. After 07 (the series commit): the panel's realtime conversation is the
final surface, so the emission fix lands on the shipped state.

## Files touched

- `supabase/migrations/00004_qa_message_policy_helper.sql` (new)
- `test/migration-replay.test.ts` — migration list pin
- `test/migration-grants.test.ts` — migration list pin + grant guard

## Prerequisites

- Sheets 01–07 committed.
- A stack where `authenticated` cannot read TICKET. Reproduce first:
  `SET ROLE authenticated;` then `SELECT count(*) FROM public."TICKET";`
  answers `permission denied for table TICKET`, and reading `"QA_MESSAGE"`
  fails the same way through the policy.

## Steps

1. Write 00004: `CREATE OR REPLACE FUNCTION public.qa_message_visible(message_id integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`.
   Mirror `conversation_participant`'s body: join `QA_MESSAGE qa` to
   `USER me WHERE me.auth_user_id = auth.uid()` and keep the four branches
   verbatim (asker, assigned facilitator, assigned speaker, ticket holder), so
   the check evaluates as the owner and touches `TICKET` without granting it.
2. Drop the inline-subquery policy and re-create it as
   `USING ("public"."qa_message_visible"("id"))`, so a replay of 00001 → 00004
   settles on the helper (00003's `IF NOT EXISTS` guard is fine: 00004 replaces
   the policy after it).
3. Append 00004 to the migration lists pinned in `test/migration-replay.test.ts`
   and `test/migration-grants.test.ts`.
4. Add a grant guard to `migration-grants.test.ts`: no
   `GRANT ... ON "TICKET" TO "anon"|"authenticated"` may exist (keeps the helper
   approach honest — a future grant becomes a reviewed decision), and 00004 must
   swap the policy to the helper.
5. Apply 00004 to the running local stack without a reset
   (`supabase db push --local`, or psql plus a `schema_migrations` row as
   fallback).
6. Re-run the role check: `SET ROLE authenticated` reads from `"QA_MESSAGE"`
   without `42501`, and `qa_message_visible` resolves true for the asker, an
   assigned facilitator/speaker, and a ticket holder, false for a stranger.

## Verification

- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all green.
- Two browser tabs in `pnpm dev` (asker + staff): a sent question appears live
  in both, no refresh.
- A from-scratch `supabase db reset` replays 00001–00004 and the panel still
  sends questions over realtime.

## Risks

- The helper must be SECURITY DEFINER with `search_path` pinned to `public`,
  exactly like `conversation_participant`, or it silently widens access and
  invites search-path hijack.
- The DROP/CREATE POLICY swap must stay replay-safe; the grants guard is what
  stops a later `GRANT SELECT ON "TICKET" TO "authenticated"` from sneaking the
  policy's subquery read back in as a public surface.
