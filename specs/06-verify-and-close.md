# 06 — Reset the dev DB, verify in an isolate, close the issue

## Goal

Prove the whole #240 change works end to end, reset the dev database onto the new schema, and leave the branch ready to commit/PR.

## Why

- The migration (sheet 01) only exists once it is replayed. Dev data is disposable here — **no backfill** — so a `db:reset` wipes and replays migrations + seed rather than rotating existing 64-hex tokens.
- AGENTS.md: "A seam is not a test." Email goes over SMTP (sockets/streams); vitest is Node and playwright serves via `pnpm start`. Only `pnpm cf:preview` answers "does this run in an isolate", and this change touches exactly the email path.

## Prerequisites

- Sheets 01–05 applied and their targeted tests green.

## Steps (in order)

### 1. Full gate set (the same as CI)

```
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Fix anything that fails before continuing. Coverage thresholds in `vitest.config.ts` are a ratchet — raise, never lower.

### 2. Reset the local database onto the new schema

`pnpm db:reset` runs `scripts/confirm-supabase-reset.mjs`, which prompts `[y/N]`; provide `y`:

```
printf 'y\n' | pnpm db:reset
```

This replays every migration (including `00007_short_qr_token.sql`) plus seed. Check the constraint is gone and lookups still resolve:

```
pnpm db:status
npx supabase db shell "\\d TICKET"   # no UNIQUE on qr_token; idx_ticket_qr remains
```

### 3. Prove the isolate path still works

The email path is the risky one. With the app running under workerd, register for an event and confirm the confirmation email shows the 6-char code in text and HTML:

```
pnpm cf:preview
```

### 4. Manual QA checklist

- Buy a ticket → `ticket_issued` email contains the 6-char code (HTML + text) and the QR.
- `/tickets` card shows the code under the QR; **no** `Payment #`, `Issued`, or `Paid` line.
- Kiosk: scan the QR → shows attendee in the confirm card → check in works.
- Kiosk: type the code by hand with different case / stray spaces → resolves the same attendee.
- Kiosk: typing a random unknown code → `Invalid QR token`.
- Check in the same code twice → second lookup reports duplicate, no second write.

## Commits

Squash-friendly, per-sheet or final:

- `feat: shorten QR check-in tokens to 6 hex characters` (sheets 01–02)
- `feat: allow case-insensitive typed check-in codes` (sheet 03)
- `feat: include check-in code in the registration email` (sheet 04)
- `refactor: remove payment meta from the ticket, surface the check-in code` (sheet 05)

Commit bodies say **why**, not what: manual kiosk entry, codes repooled after check-in, email is the no-camera fallback, the filter-metadata stripped from tickets is bookkeeping a gate never checks.

Update `CHANGELOG.md` for this meaningful user-facing change (shorter codes, email fallback, ticket card change).

## Done when

- All four gates pass clean.
- `db:reset` replays the migration without error.
- `pnpm cf:preview` shows the code in the emitted email.
- Manual QA list above passes.
