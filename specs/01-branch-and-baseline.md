# 01 — Branch and baseline

## Goal

Stand up the working branch this effort ships on and pin the baseline facts the
reset-email work is measured against, so later sheets start from one shared
"before".

## Where

- `git checkout -b feat/dev-mail-capture-box` (base `77ff37f`).
- `supabase/config.toml` — `auth.email.smtp` → local `127.0.0.1:1025` (GoTrue →
  inbucket), `otp_expiry = 86400`, resend `max_frequency = "1s"`.
- Failure I set out to fix: the recover route reported `sent` even when no mail
  had actually left the app — the delivery path was unawaited, so a dead relay
  looked successful.

## Why

Two independent truths drive the whole effort:

1. **The app must not claim delivery it never attempted.** The landing route
   reported a reset link as sent while the send had never resolved. A loopback
   guard, a host-specific socket seam, and an awaited verdict each remove one
   way that lie can happen.
2. **Dev mail belongs in a local capture box, never a real relay.** `next dev`
   has no `cloudflare:sockets`; its only legal SMTP destination is the loopback
   capture box (`127.0.0.1:54325`) that GoTrue's own auth mail already lands
   in. A random dev never configures SMTP to reach a real mailbox by accident.

## Steps

1. Verify baseline: local stack containers running (studio, pg_meta, auth, etc.),
   `pnpm db:env local` pointing `NEXT_PUBLIC_SUPABASE_URL` at
   `http://127.0.0.1:54321`, and GoTrue mail already arriving in inbucket.
2. Confirm the lie: reset a real account and observe the route answering
   `sent` while the SMTP session errors were swallowed.
3. Commit the branch base untouched.

## Verify

- `git branch --show-current` = `feat/dev-mail-capture-box`.
- `supabase status` shows the auth container up.
