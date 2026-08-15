# 12 — Verify the email-change cancel primitive (the dev gate)

## Purpose

Sheet 10 shipped `POST /api/auth/email/cancel` on an assumption that was never
proven: that `getServiceClient().auth.admin.updateUserById(id, { email })` (the
admin server write the route uses) actually drops `new_email` from GoTrue's user
record. The sheet's own "verify-in-dev checkpoint" was written but never run, so
the route may currently be reassuring the UI while that it clears something
server-side it does not clear. Sheet 13's design (a real `Cancel` on the pending
status) only makes sense if this holds. This sheet runs the gate against the
live local stack and pins the outcome before any further UI work.

## Background (current code)

- A self-service email change (our route calls
  `rb.auth.updateUser({ email })` against GoTrue) does not move the address. With `[auth.email]` `enable_confirmations =
true` and `double_confirm_changes = true` (`supabase/config.toml:223`, `:226`),
  it sets a pending change on the user object — `new_email`,
  `email_change_sent_at`, plus the one-time tokens
  (`email_change_token_new`/`email_change_token_current` and
  `email_change_confirm_status`) — mails the `email_change` template to **both**
  the old and the new address, and only a click on the confirm link (or admin
  rewrite) lands the change.
- The cancel route (`src/app/api/auth/email/cancel/route.ts`) re-reads the session
  with `getRouteClient()`, answers `409 { error: "Nothing to cancel." }` when no
  `new_email` is pending, then runs the admin write
  `updateUserById(session.user.id, { email: session.user.email })` and echoes the
  result. The spec's claim is that an admin `email` write applies directly,
  without confirmation, and rewrites the address and its one-time tokens — which
  drops the pending change entirely.
- Whether that claim is true locally is exactly what was never checked. The
  hosted project inherits the same primitive, so the gate answer transfers.
- The local stack is already reachable for this (status in `supabase status`):
  GoTrue at `http://127.0.0.1:54321`, Mailpit at `http://127.0.0.1:54324`, keys in
  `pnpm supabase status --output env`. Mailpit doubles as the inbox, so both
  addresses' mails are observable without real mailboxes.
- No migration and no code change is required to run the gate — it is a script
  against GoTrue's own HTTP API, the same endpoints the client library wraps.

## Scope

- A throwaway script (in `/tmp`, not the repo) exercising the exact primitive.
- The decision it produces drives sheet 13: **gate PASS** → ship the server-backed
  Cancel; **gate FAIL** → remove the cancel route and sheet 13's Cancel becomes a
  client-only dismiss with honest "the change expires on its own" copy.

## Steps

### 1. Set up a test avatar

- `pnpm supabase status --output env` for `SUPABASE_ANON_KEY` and the
  `service_role` key (not the JWT secret).
- Admin-create a disposable user:
  `POST /auth/v1/admin/users` (apikey: service_role) with
  `{ "email": "gate-<ts>@example.test", "password": "...", "email_confirm": true }`.
  Record `id` and the email.
- Grab a user token: `POST /auth/v1/token?grant_type=password` (apikey: anon)
  with the credentials → `access_token`.

### 2. Establish the pending change

- `PUT /auth/v1/user` (apikey: anon, `Authorization: Bearer <access_token>`) with
  `{ "email": "gate-change-<ts>@example.test" }` — the same self-service call the
  send route makes.
- Assert via `GET /auth/v1/admin/users/{id}` that `new_email` equals the target
  and `email_change_sent_at` is set (the record sheet 09's restore reads).
- Check Mailpit (`http://127.0.0.1:54324`) — exactly two `email_change` mails
  should now exist: one to the old address, one to the target. This also verifies
  the double-confirm mail behavior sheet 14's template rides on.

### 3. Run the cancel primitive

- `PUT /auth/v1/admin/users/{id}` (apikey: service_role) with
  `{ "email": "<original email>" }` — literally the admin write in the route.

### 4. Re-read and decide

- `GET /auth/v1/admin/users/{id}`.
  - **PASS (gate true):** `new_email` is cleared and the email-change token fields
    no longer reference the target. Sheet 13 proceeds with the server-backed
    Cancel; this sheet commits nothing but this result (recorded here / in the
    commit message).
  - **FAIL (gate false):** `new_email` survives the admin write. Then:
    - delete `src/app/api/auth/email/cancel/route.ts` and `test/api-auth-email-cancel.test.ts`;
    - convert the cancel tests in `test/use-account-settings.test.tsx` into
      client-only dismiss assertions (restore the pre-sheet-10
      `useDifferentEmail` semantics: flip `emailSent`/`resendIn` only, no fetch);
    - the auth sweep (`test/api-auth-coverage.test.ts`) needs no edit — it only
      demands a guard from routes that exist;
    - sheet 13 substitutes its Cancel wiring with that dismiss.

### 5. Clean up

- `DELETE /auth/v1/admin/users/{id}` (service role) to drop the avatar; record
  the re-read and mail evidence in this sheet's outcome for the sheet-13 handoff.

## Verify

```sh
pnpm test test/api-auth-email-cancel.test.ts test/use-account-settings.test.tsx
pnpm test test/api-auth-coverage.test.ts
```

- PASS path: no source changes; the two tests above stay green as the route
  currently ships.
- FAIL path: the two tests above are replaced per Step 4; `pnpm format && pnpm
lint && pnpm typecheck` and the full suite must pass with the route gone.

## Commit

PASS ships no diff; record the result:

```
chore(settings): verify the email-change cancel clears the pending change
```

Body (PASS): ran the sheet-12 gate against the local stack — service-role
`updateUserById({ email: <current> })` drops `new_email` after a self-service
change request, so the sheet-10 cancel route's server write is genuine and sheet
13 can ship a server-backed Cancel.

FAIL carries the removal instead:

```
fix(settings): drop the cancel route, GoTrue does not clear the pending change

Body: the admin email-rewrite sheet 10 bet on leaves new_email on the record, so
a server Cancel would be a lie. Removing the route and testing the client-only
dismiss that actually exists; the change expires at otp_expiry as designed.
```

## Definition of done

- The gate has been run against the live local stack and its outcome is recorded.
- PASS: the cancel route's admin write is proven to clear `new_email`; sheet 13
  ships the server-backed Cancel.
- FAIL: the cancel route, its route test and its hook assertions are gone; sheet
  13's Cancel is a dismiss labelled honestly as "expires on its own".
