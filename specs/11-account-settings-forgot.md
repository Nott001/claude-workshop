# 11 — Account settings: forgotten-password link

## Goal

Give a signed-in user on the password/account-settings screen a way back to the
recover flow, so "I don't remember my password" works even while logged in.

## Where

- `src/modules/user/components/password-section.tsx` — "Forgot Password?" link
  → `/forgot-password`.
- `src/modules/auth/components/forgot-password-form.tsx` — accepts the address
  the settings screen already knows.
- `test/password-section.test.tsx` (or the account-settings suite).

## Why

- The recovery path was reachable only from the sign-in screen; a logged-in
  user staring at the password field had nowhere to go when the remembered
  password turned out wrong.
- The link is cheap and honest: it lands on the same form whose copy is
  truthful (spec 10) and whose rate limiting is address-bound (spec 08), so a
  signed-in user is not creating an enumeration hole by coming back to it.

## Steps

1. In `PasswordSection`, render an anchor to `/forgot-password` labeled
   "Forgot Password?" beside the change-password control.
2. Optionally prefill the email from the signed-in profile.
3. Test: the link renders with the expected href; clicking navigates.

## Verify

- `pnpm test`: password-section suite green.
- Local: sign in → Account Settings → Password → "Forgot Password?" opens the
  recover form.
