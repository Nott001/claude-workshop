# 06 — Dev capture box: auto-route + real envelope sender

## Goal

Give `next dev` mail a zero-config destination and a valid identity. The
capture box is reached by the app on `127.0.0.1:54325` (GoTrue reaches the same
box by docker-network alias on 1025). The `MAIL FROM` must be a real-shaped
address, not the username.

## Where

- `src/shared/integrations/email/index.ts` — `devCaptureBoxConfig()`,
  `pointsAtLocalStack()`.
- `.dev.vars` — `SMTP_HOST=127.0.0.1`, `SMTP_PORT=54325`,
  `SMTP_USER=inbucket`, `SMTP_PASSWORD=inbucket`,
  `SMTP_FROM_EMAIL=no-reply@startuplab.center`.
- `docs/LOCAL_DB.md`, `docs/DEPLOYMENT.md`.

## Why

- Port cap: 54325 is the capture box's _host-published_ SMTP port; GoTrue's
  alias (1025) is container-internal and unreadable from the host process.
- `readSmtpConfig` parsed with a loopback host yields plaintext per spec 03
  without restating the rule.
- The `from` bug (553, "invalid sender"): the default inherits the username —
  `inbucket` is not a syntactically valid envelope sender. Pinning
  `no-reply@startuplab.center` fixes the 553 so the box accepts the message.
- Routing to "the capture box GoTrue's own mail already lands in" means app
  mail (resets, invites) shares one dev inbox with auth mail by default.
- The real relay is only ever reachable from `pnpm dev` if a developer
  deliberately sets `SMTP_HOST` to a non-loopback host — and then the security
  mode flips to TLS (spec 03), keeping the password safe even then.

## Steps

1. `devCaptureBoxConfig()` = `readSmtpConfig({127.0.0.1:54325, inbucket,
no-reply@startuplab.center})!` (never null — every field present).
2. Auto-route fires only when `pointsAtLocalStack()` (local Supabase URL) and
   no explicit SMTP config, i.e. the one dev mode where a capture box is
   guaranteed to exist.
3. `.dev.vars` pins the same values explicitly so `pnpm cf:preview` also
   delivers into Mailpit.
4. Document in `docs/LOCAL_DB.md` (Auth/email capture section, ports 54324 UI /
   54325 inbound) and `docs/DEPLOYMENT.md` env matrix.

## Verify

- Send a reset under `pnpm dev`; message appears in the Mailpit web UI
  (54324) with `From: no-reply@startuplab.center`.
- `pnpm cf:preview` envelope sender also accepted (no 553).
