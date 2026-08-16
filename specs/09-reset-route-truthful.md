# 09 — Reset route: truthful statuses on the wire

## Goal

Make both recover routes tell the browser what _actually_ happened: the POST
answers `sent` only once mail is on its way, `delivery_failed` when a real send
failed, `unknown_email`/`rate_limited`/`invalid_request` otherwise. The confirm
route reports a real reason (`invalid_token | weak_password | personal_password`)
instead of a generic "bad code".

## Where

- `src/app/api/auth/recover/route.ts` — POST runs `preparePasswordReset` then
  **awaits** `deliver()`; maps `ResetOutcome`/`RecoverStatus` to the response.
- `src/app/api/auth/recover/confirm/route.ts` — POST maps `ConfirmResult`.
- `src/modules/auth/lib/password-reset.ts` — `RecoverStatus` (the single wire
  contract both ends import).
- `test/api-password-reset.test.ts`.

## Why

- The whole effort is about one lie: "we told the visitor it was sent while
  the send had not finished". Routing through the returned `deliver` closure
  and awaiting it kills that lie at the top — the reply is issued after the
  SMTP verdict.
- `RecoverStatus` declares `ready → sent` and keeps `delivery_failed` distinct
  from `failed` (link never minted at all) and `invalid_request` (rejected
  before the service). One definition, imported by route and form, so the wire
  contract cannot drift.
- `unknown_email` is reported on purpose (see spec 08/11): the per-IP limit is
  what keeps that honesty from becoming an enumeration risk.
- The confirm side spends the token (verifyOtp) then updates the password;
  an update failure after the link is spent cannot be retried with the same
  link, so it must map to an honest `invalid_token` rather than a fake success.

## Steps

1. POST recover: normalize email → call `preparePasswordReset`; on
   `ready` run `await outcome.deliver()` and reply `sent` on success,
   `delivery_failed` on `{ success: false }`.
2. Non-`ready` outcomes answer their own status verbatim. Malformed body /
   missing email → `invalid_request` (400).
3. POST confirm: first price the password against the policy rules that need
   no identity (cheap, spends nothing); a failure is `weak_password`. After
   `verifyOtp`, the identity-dependent rule runs; a failure is
   `personal_password`. Errors otherwise are `invalid_token`.
4. Tests drive the mocked service: each `ResetOutcome` → its expected HTTP
   status + body, and the confirm branches → their reasons.

## Verify

- `pnpm test`: api-password-reset suite asserts status + body per branch.
- Under `pnpm dev`, break SMTP (dead port) and watch the form render the
  delivery failure instead of "check your inbox".
