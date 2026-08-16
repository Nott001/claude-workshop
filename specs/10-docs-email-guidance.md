# 10 — Docs: correct and complete the email guidance

## Goal

Make the docs true again after sheets 02-05: reset links (and the rest of the project's mail) do land in inbucket in dev once the seam is pointed at it, and the deployment notes no longer claim Supabase mails password recovery.

## Where

- `docs/LOCAL_DB.md` — "Auth / email" section
- `docs/DEPLOYMENT.md` — "After setting secrets" / two-senders note, optional overrides list
- `.dev.vars.example` — SMTP comment block

## Why

Two statements are now wrong or incomplete. `LOCAL_DB.md:47` says the "confirm / reset link lands in inbucket", which was only ever true for GoTrue-sent mail — this repo's reset link is minted by GoTrue and mailed by the project seam, which previously printed to the terminal. And `DEPLOYMENT.md:84` says "Supabase sends … password recovery from its own servers", which the code deliberately reversed (`src/modules/auth/lib/password-reset.ts:89-91` mints and lets the project mail it). The sheets fix the mechanics; this sheet keeps the record from drifting again.

## Steps

1. In `docs/LOCAL_DB.md`, under **Auth / email**, extend the inbucket note so project mail is covered. Change the sentence starting "For any other sign-up or a password-recovery flow…" so it conditions on the stack below, e.g.:

   ````md
   Seeded users are **already confirmed**, so those logins work immediately (see
   the table). GoTrue's own mail — sign-up confirmations and email-change links —
   always lands in inbucket → **Studio → inbucket** (or http://127.0.0.1:54324).

   The project's own transactional mail — password-reset links, organization
   invites, tickets, check-in receipts — is delivered by the app's SMTP seam, not
   by GoTrue, so it reaches inbucket only when the seam points at it. Add this to
   `.env` (the file `pnpm dev` reads; `pnpm db:env` rewrites only the Supabase
   lines, so it survives toggling):

   ```env
   SMTP_HOST=127.0.0.1
   SMTP_PORT=54325
   SMTP_USER=inbucket
   SMTP_PASSWORD=inbucket
   ```
   ````

   inbucket does not authenticate, so any non-empty `SMTP_USER`/`SMTP_PASSWORD`
   satisfies the config reader. A loopback host defaults to plaintext, so no
   `SMTP_SECURE` is needed; leave the host unset (or at a remote address) and
   `next dev` falls back to logging to the terminal — in which case a reset still
   hands the link back on its own success screen. Note the reverse: with the
   capture box configured but inbucket down, a reset answers `delivery_failed`
   rather than falling back to the console, because the seam is genuinely trying
   to mail.

   ```

   ```

2. In `docs/DEPLOYMENT.md`:

   a) Fix the "Leave the three `SMTP_*` unset" paragraph (lines 68-73). It said
   "`next dev` still logs to the console instead — it has no socket either
   way", which sheet 05 makes false for a loopback-configured dev machine, so
   it becomes host-dependent:

   ```md
   `next dev` only dials a loopback capture box, so a remote host there still
   means logging to the console — dev credentials can never accidentally mail a
   real relay.
   ```

   b) Fix the two-senders bullet (lines 83-86) so recovery is attributed to the worker mailbox, not Supabase:

   ```md
   - **The worker** sends ticket, check-in, organization-invite **and
     password-recovery** mail through the `SMTP_*` mailbox above. Recovery mints
     its link through GoTrue's admin API but emails it from here with the same
     branded template as the invitation, which is why its template lives with the
     others in `src/shared/integrations/email/`.
   - **Supabase** sends sign-up confirmation and email-change mail from its own
     servers, configured under **Authentication → SMTP Settings** (port 587).
     Those templates exist only in the dashboard.
   ```

   c) Update the send-latency sentence (lines 92-94, "Ticket and check-in delivery
   runs after the response…") so recovery joins the awaited set, and note the
   failure it surfaces:

   ```md
   Ticket and check-in delivery runs after the response, so a slow send costs no
   request latency. Invites and password recovery are awaited instead: the
   requester has to be told the mail did not go out. A set of `SMTP_*` values
   that still reach no server (e.g. the loopback capture box is down in dev)
   shows up as a `delivery_failed` reply from the recovery route.
   ```

   d) Add `SMTP_SECURE` to the optional overrides list (the sentence starting "`SMTP_PORT`, `SMTP_FROM_EMAIL`, …", lines 74-75):

   ```md
   `SMTP_SECURE` defaults to plaintext when `SMTP_HOST` is loopback and to
   implicit TLS otherwise, so a local capture box needs no extra setting and a
   remote relay is never sent a password unencrypted by accident.
   ```

3. In `.dev.vars.example`, extend the SMTP comment block (lines 19-28) with the dev-capture mode and keep the optional-overrides stanza (lines 30-38), so a contributor running `cf:preview` against inbucket knows what it needs:

   ```dotenv
   # Transactional email. SMTP needs the Workers runtime for its socket, so
   # `next dev` only dials a loopback host (see LOCAL_DB.md — set SMTP_* in .env);
   # `pnpm cf:preview` talks to whatever SMTP_HOST is configured here.
   # On workerd, leaving any of the three unset makes a send fail rather than
   # log: a missing mailbox is a misconfiguration, not a fallback.
   #
   # Pointing at the local capture box (plaintext, no auth) is just:
   #   SMTP_HOST=127.0.0.1
   #   SMTP_PORT=54325
   #   SMTP_USER=inbucket
   #   SMTP_PASSWORD=inbucket
   #
   # Never rename these to NEXT_PUBLIC_*: the compiler would inline the password
   # into the client bundle.
   SMTP_HOST=
   SMTP_USER=
   SMTP_PASSWORD=

   # Optional. Defaults: 465 for SMTP_PORT (54325 for inbucket), implicit TLS
   # unless SMTP_HOST is loopback (plaintext), the SMTP_USER mailbox, "Startup
   # Lab", 30000, 2. SMTP_REPLY_TO is omitted unless set.
   # SMTP_PORT=
   # SMTP_SECURE=
   # SMTP_FROM_EMAIL=
   ...
   ```

Do not change the `.env.example` committed template — its readers are placeholders only and the SMTP_* keys already exist there.

## Definition of done

- `LOCAL_DB.md` explains where GoTrue mail and project mail each land, with the dev `SMTP_*` block for the `.env` and the `delivery_failed`-when-inbucket-is-down gotcha.
- `DEPLOYMENT.md` attributes password recovery to the worker seam, documents `SMTP_SECURE`, and no longer claims `next dev` has no socket path or that Supabase mails recovery.
- `.dev.vars.example` shows the capture-box mode for `cf:preview` and lists `SMTP_SECURE`.
- No code changed in this sheet (`pnpm test` still green).

## Verify

```sh
pnpm test
```
