# 13 — Pending email-change status with Resend + Cancel

## Purpose

Products that treat a pending confirmation as a first-class state show it as a
status with two honest controls — **Resend** and **Cancel** — and cancel is
server-backed so it genuinely voids the pending operation (the withdrawal flows
at Phemex/Koinbay/Bitazza are the reference: "Pending email confirmation" +
Resend on a 60s cooldown + Cancel, offered only while the operation is still
pending). Sheet 10 delivered the server cancel but dressed it as a "Use a
different address" escape hatch, so it never reads as a status and its real
behavior (return to the address on file) is a surprise. Rework, per the sheet-12
gate: the pending state becomes an explicit **Email change pending** status and
**Cancel** is the only way back to the field.

## Background (current code)

- `email-section.tsx:41-66` renders the sent state as a banner ("Verification
  link sent to …") with a resend countdown and a **Use a different address**
  button wired to `onUseDifferent`. Putting a cancel behind that label is why the
  affordance felt wrong: it behaves like a cancel but reads like a redirect.
- `use-account-settings.ts:353-368` `cancelEmailChange` POST
  `/api/auth/email/cancel`; on `ok` it already sets `emailSent false`, `resendIn
0` and `setNewEmail(currentUser?.email ?? "")` — i.e. it returns the form to the
  address actually on file, exactly a cancel. On failure it toasts and keeps the
  sent state.
- The route (`src/app/api/auth/email/cancel/route.ts`) is guarded (`requireAuth`
  → 401), answers `409 { error: "Nothing to cancel." }` when no `new_email` is
  pending, and runs the sheet-12-verified admin write.
- The driving bug this design removes: sheet 09's restore re-shows the pending
  banner from GoTrue's `new_email` on every reload. A **client-only** dismiss
  resurrects on reload; a **server-backed** cancel does not — after Cancel the
  restore finds nothing, which is the first option where the pending state can
  actually be gone before `otp_expiry` (1h, `config.toml:237`).
- Deliberately **not** copying the crypto flows' attempt caps or 30-minute
  windows: those exist because money; a pending email change is inert. Only the
  status shape, the resend cooldown (already 60s, `RESEND_COOLDOWN_SECONDS`) and
  the while-pending cancel transfer. Sending a _different_ address still
  supersedes a pending change in GoTrue, and that remains available once the
  field is back.
- Depends on sheet 12's gate. If it FAILed, this sheet ships in its fallback
  form (last paragraph of Step 1/2 + the Verify swap below).

## Scope

- `email-section.tsx` — the sent-state block becomes the pending-status block.
- `account-settings.tsx` — rename the prop; nothing else.
- Hook and routes unchanged (the sheet-10 work already carries the behavior).

## Steps

### 1. Pending-status block

Replace the banner in `email-section.tsx` with:

- Header **Email change pending**.
- Body: "We emailed a confirmation link to **{newEmail}**. It expires in about an
  hour if you don't confirm."
- Controls row, same placement as today:
  - **Send again** — unchanged, `resendIn` countdown.
  - **Cancel** (was "Use a different address") — fires the cancel action.
- Rename the prop `onUseDifferent` → `onCancel` in the interface and the call
  site; drop the old label and the "Use a different address" copy in
  `email-section.tsx` (a "use a different address" intent is served by Cancel
  then typing, or by Cancel not being needed at all). The `emailSent` branch is
  the only thing that changes; the idle field branch stays.

### 2. Cancel wiring

- `account-settings.tsx:57` — `onUseDifferent={settings.cancelEmailChange}` →
  `onCancel={settings.cancelEmailChange}`.
- After a successful Cancel the field returns showing
  `currentUser?.email ?? ""` (already implemented in `cancelEmailChange`), and a
  reload finds nothing to restore — add a smoke assertion for the no-restore
  case if it is not already covered.
- **Fallback (sheet-12 gate FAIL):** Cancel is instead a client-only dismiss —
  `setEmailSent(false)`, `setResendIn(0)`, keep the field contents; body copy
  becomes "The link expires on its own — to send to a new address, type it below."
  No route call, and the restore from sheet 09 will re-show the banner after a
  reload until the token expires; say so in the copy rather than implying the
  pending state vanished.

## Tests

- `test/email-section.test.tsx` — pending-state copy ("Email change pending",
  expiry wording), the Cancel button label, the `onCancel` prop, and that the
  "Use a different address" button is gone.
- `test/use-account-settings.test.tsx` — existing cancel cases already assert the
  reset contract; add the reload-finds-nothing interplay if absent (cancel → the
  restore effect no-ops).
- `test/account-settings.test.tsx` — fixture/simulated click moves to the renamed
  prop.
- Fallback only: turn the cancel cases into dismiss cases and stub fetch so the
  cancel route is never hit.

## Verify & commit

```sh
pnpm test test/use-account-settings.test.tsx test/email-section.test.tsx test/account-settings.test.tsx
pnpm test test/api-auth-email-cancel.test.ts test/api-auth-coverage.test.ts
pnpm format && pnpm lint && pnpm typecheck
pnpm test
```

Ratchet coverage thresholds only if the measured numbers genuinely move. Smoke in
`pnpm dev`: send a change → the status reads **Email change pending**; reload
mid-countdown → still pending; **Cancel** → field snaps back to the address on
file and a reload finds nothing to restore. (Fallback: reload midway shows the
banner again until expiry and the copy says so.)

Commit:

```
feat(settings): show a pending email-change status with a real cancel
```

Body: the sent banner's "Use a different address" was a cancel wearing a
redirect's clothes, so it both hid that the pending change had a real server-side
void (sheet 12-verified) and never read as a status. Presenting the pending state
as **Email change pending** with Resend on the 60s cooldown and a Cancel that is
the only way out matches how consequential pending confirmations are surfaced
elsewhere, and — because the cancel clears `new_email` server-side — sheet 09's
restore finds nothing after a reload, so the resurrecting banner is finally gone
before the token expires.

## Definition of done

- While an email change is pending the section shows **Email change pending**,
  the expiry horizon, Resend (cooldown intact) and Cancel — nothing else
  labelled as a redirect.
- Cancel returns the field to the address on file and survives reload (restore
  no-ops).
- The "Use a different address" affordance is gone; a different address is
  reached by cancelling first.
- Fallback only: Cancel is an honest client dismiss whose copy admits the change
  survives until expiry.
