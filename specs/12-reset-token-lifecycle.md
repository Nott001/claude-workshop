# 12 — Reset token lifecycle: one table, one live link

## Goal

Answer the design question "should token storage be centralized into a single
table rather than scattered?" with the verified mechanism it already has, and
pin that behavior so it is not re-litigated as a feature request.

## Finding (verified live, Aug 2026)

**GoTrue centralizes every auth token in `auth.one_time_tokens`, and that one
table already rotates recovery links.** No app-side table, DAO, or migration is
needed — one exists and would only duplicate state that can drift from what
`verifyOtp` actually accepts.

## The mechanism

- `supabase.auth.admin.generateLink({ type: "recovery", email })` mints a
  token stored in `auth.one_time_tokens` with `UNIQUE (user_id, token_type)`.
- Minting a second recovery link for the same user **replaces** the row the
  first one occupies — the older link immediately stops verifying.
- `verifyOtp({ type: "recovery", token_hash })` succeeds only for the current
  row, and spending it removes the row: one-time use holds.
- Live proof: minted twice for `rotatetest@example.com`;
  `verifyOtp` with the _first_ hash after the second mint →
  `otp_expired "Email link is invalid or has expired"`; the newest token
  verifies; the user's row count returns to 0 after the spend.
- The email-change variant (`00006_cancel_pending_email_change.sql`) needs a
  SECURITY DEFINER DELETEs, but **recovery does not**, precisely because the
  UNIQUE constraint replaces on mint. That difference is why the two look
  asymmetrical — they are different invariants.

## Where

- Live data: `docker exec supabase_db_claude-workshop-local psql … -c
"\d auth.one_time_tokens"` — columns `id uuid PK, user_id FK users ON DELETE
CASCADE, token_type, token_hash, relates_to, created_at, updated_at`; unique
  index `one_time_tokens_user_id_token_type_key`.
- App path: `preparePasswordReset` → `generateLink` →
  `/reset-password?token=<hashed_token>` → `confirmPasswordReset` →
  `verifyOtp` + `updateUser` (password-reset.ts:95-171).
- `supabase/config.toml`: `otp_expiry = 86400`, resend `max_frequency = "1s"`.
  Expiry length is now moot for stale recovery links — replacement invalidates
  them instantly, not a timer.

## Why

- "Centralize it" is already the state of the world: `auth.one_time_tokens` is
  the single authority for every token the auth server hands out (recovery,
  invite, email-change, confirmation). Splitting it into app-owned tables that
  mirror the same data is the _scattering_ the question warns about.
- The one app-owned table, `public.PASSWORD_RESET_ATTEMPT`, is **not** token
  storage. It is the rate-limiter ledger (spec 08) — a different concern the DB
  is right to own.
- The lockout regression (13 `PASSWORD_RESET_ATTEMPT` rows during local
  testing) was a dev-only artifact of the new limiter, cleared by
  `DELETE ... id=gt.0` via REST; a real user is not lockable past 15 minutes by
  accident, only by 3 genuine requests inside the window.

## Steps (applies to future token work)

1. Before adding any token table, check whether `auth.one_time_tokens` already
   covers the lifecycle; if mint+verify already rotate via its UNIQUE
   constraint, there is nothing to build.
2. Only add a SECURITY DEFINER revoke (the 00006 pattern) when GoTrue _keeps_
   stale state a user must be able to void server-side (e.g. a pending email
   change that refires acceptEmailChange).
3. Never report a non-token failure as "no such account" — see the `failed`
   distinction in spec 09.

## Verify

- Live: mint twice, confirm the first link answers `otp_expired`, the newest
  verifies, and the spend leaves zero rows for that user.
- `pnpm test` reset-flow suites still green (they stub the same verifyOtp).
