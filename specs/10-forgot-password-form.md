# 10 — Reset form: honest copy + dev-link handover

## Goal

Render the reset form's state machine on the wire contract, and hand the minted
link back to the developer **only** when delivery genuinely cannot happen
locally (console-only logging under `pnpm dev`). Show a working demo of the
flow in one click.

## Where

- `src/modules/auth/components/forgot-password-form.tsx` — status →
  copy map (`sent`, `delivery_failed`, `rate_limited`, `unknown_email`, …).
- `src/app/auth/forgot-password/page.tsx` — page that hosts the form.
- `src/app/reset-password/page.tsx` — confirm form surface.
- `src/shared/integrations/email/index.ts` — `emailDeliveryIsLocal()`.
- `test/forgot-password-form.test.tsx`.

## Why

- The form is a view over `RecoverStatus`; a non-`sent` status needs its own
  guidance or the honest route speaks to nobody. `delivery_failed` tells the
  visitor to retry, `rate_limited` tells them to wait 15 minutes,
  `unknown_email` explains the address has no account.
- Dev handover exists only because the console provider cannot send; the route
  already knows that via `emailDeliveryIsLocal()`. When it can actually reach
  a capture box (spec 06), no link is revealed — mail really went out.
- Exposing a reset URL grants password-reset privileges, so the reveal only
  ever happens in the dev variant and only for the console fallback.

## Steps

1. Wire form `status` → message; keep an `emailDeliveryIsLocal()` check to
   decide reveal availability rather than peeking at the status string.
2. When local-console delivery is on, render the returned `resetUrl` in a
   callout (copy + open), with copy reading "delivery is logged locally".
3. Keep the confirm page bound to `/reset-password?token=`.
4. Component tests: each status renders its message; the reveal element is
   absent when delivery is not local.

## Verify

- `pnpm test`: forgot-password-form suite asserts the copy map and the
  reveal gate.
- Under `pnpm dev` with SMTP to dead port: delivery failure shows honest copy.
  With auto-route: link goes to Mailpit, no reveal shown.
