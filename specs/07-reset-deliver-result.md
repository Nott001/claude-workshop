# 07 — Deliver returns a verdict

## Goal

Make reset delivery **report its result** instead of being side-effect-fired.
`deliverPasswordReset` returns an outcome value (`sent | delivery_failed |
rate_limited | missing_user`), and `sendTemplatedEmail` propagates a provider
failure rather than swallowing it.

## Where

- `src/modules/auth/lib/password-reset.ts` — `ResetOutcome`, `deliver`/`record`
  and `notifyAdmin` wiring, rate limiting.
- `src/shared/integrations/email/providers/smtp/index.ts` — retry loop and
  `SmtpError` throw.
- `test/password-reset.test.ts`, `test/email-integration.test.ts`.

## Why

- The observed lie: the route printed `sent` while the send promise had been
  created but never awaited, so a dead relay looked successful. An `await`ed
  send that throws removes half of that lie automatically.
- Rate limiting is the other half: a flood of failed attempts must surface as
  `rate_limited`, not as 13 silent wins.
- Category ids (`attemptsTooMany`, `coolingDown`, `unknown`) give the form a
  keyed message without the template knowing SMTP details.
- "Delivery failed but don't tell anyone" is the failure mode being killed —
  the verdict is the unit of work.

## Steps

1. `deliver` calls `sendTemplatedEmail` and returns the outcome; a thrown
   provider error becomes `delivery_failed` (route reply `"error: delivery
failed"`, HTTP 200, category `deliveryFailed`).
2. Retry policy (config.ts `DEFAULT_ATTEMPTS = 1` re-send) happens _inside_
   the provider, so a stalled greeting gets a second connection without the
   route knowing.
3. Keep the concept of pre-send rate limiting (`rate_limited`, 429-ish
   category) in the same returned union.
4. Tests assert the returned outcome for each branch, calling the real
   function — not shape-matching an object literal.

## Verify

- `pnpm test`: provider failure → `delivery_failed`; limit hit →
  `rate_limited`; unknown email → `missing_user`; happy path → `sent`.
- Point SMTP at a dead port; reset answers honestly the first time.
