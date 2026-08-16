# 03 — SMTP config: safe-by-default security mode

## Goal

Make `secure` follow the host unless explicitly overridden. A loopback host is
**plaintext** by default (inbucket speaks no TLS and localhost interception is
moot); any remote host defaults to **implicit TLS** so a password can never be
sent unencrypted to a real relay by accident. `SMTP_SECURE=off|on` wins over
both.

## Where

- `src/shared/integrations/email/providers/smtp/config.ts` — `isLoopbackHost()`,
  `parseSecure()`, `readSmtpConfig()`.
- `.env`, `.dev.vars` — the `SMTP_*` block.
- `.env.example`, `docs/DEPLOYMENT.md` env-files table.

## Why

- The old default was implicit-TLS-always; pointing `.env` at inbucket then
  failed because nothing local speaks TLS, and the failure surfaced only at
  send time far from the cause.
- Security follows the _risk_: to localhost there is no one to eavesdrop on;
  to anything else the password is credentials in transit and must be TLS.
- Explicit `SMTP_SECURE` must still be able to force either direction — a
  dev running a reverse-terminated TLS listener on 127.0.0.1, or a remote
  relay fronted without TLS, are both legitimate.
- Do **not** name any of these `NEXT_PUBLIC_*` — the Next compiler inlines
  those into the client bundle and would publish the password.

## Steps

1. `isLoopbackHost(host)` treats only `127.0.0.1`, `localhost`, `::1` as
   loopback; everything else is remote and TLS.
2. `parseSecure(raw, host)`: `"off"/"false"/"0"` → false, `"on"/"true"/"1"` →
   true, otherwise `!isLoopbackHost(host)`.
3. `readSmtpConfig(env)` returns `null` (never throws) when host/user/password
   are missing so callers degrade to the console provider instead of failing
   every registration.
4. Default `fromEmail` to the authenticated mailbox, because cPanel rejects a
   `MAIL FROM` the account does not own (see spec 06 for the dev override).
5. `replyTo` stays unset unless `SMTP_REPLY_TO` is provided — a Reply-To
   nobody reads is worse than none.

## Verify

- `pnpm test` asserts `readSmtpConfig({ …127.0.0.1, no SMTP_SECURE })` → secure
  false, and `readSmtpConfig({ …example.com })` → secure true.
- Setting `SMTP_SECURE=off` flips any host to plaintext.
