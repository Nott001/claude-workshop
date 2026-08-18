# 07 — Reset the dev DB, verify end to end, close the issue

## Goal

Prove the whole #266 change works in both directions (staff kiosk and attendee pass), reset the dev database onto the final schema, and leave the branch ready to push/PR.

## Why

- The migration (sheet 01) and any replica-identity follow-up only count once replayed; a final `db:reset` proves the whole chain replays cleanly on top of seed.
- Realtime is a browser WebSocket path: vitest is Node and Playwright serves via `pnpm start`, so the live-update behavior has to be verified against the running app + local Supabase. `pnpm cf:preview` is the only "does this run in an isolate" check (AGENTS.md); supabase-js realtime is already used app-wide, but the pass page is a new subscriber, so run it if you can — it was skipped by operator call on the previous issue.

## Prerequisites

- Sheets 01–06 applied, each with its targeted tests green.

## Steps (in order)

### 1. Full gate set (the same as CI)

```
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Fix anything that fails before continuing. Coverage thresholds in `vitest.config.ts` are a ratchet — raise, never lower.

### 2. Reset the local database onto the final schema

`pnpm db:reset` runs `scripts/confirm-supabase-reset.mjs`, which prompts `[y/N]`; provide `y`:

```
printf 'y\n' | pnpm db:reset
```

Confirm the final state:

```
npx supabase db shell "\d TICKET"   # SELECT grant to authenticated; ticket_visible policy
npx supabase db shell "SELECT policyname FROM pg_policies WHERE tablename = 'TICKET';"
```

### 3. Manual QA checklist

Use the seeded accounts (`dev-password-123`): **Casey Facilitator** (`facilitator@example.com`, assigned to the active `Product Summit 2026` event), **Riley Admin** (`admin@example.com`), **Alex Attendee** (`attendee@example.com`, holds a seeded ticket).

Kiosk / staff:

- Open `/staff/events/<event id>/kiosk` as Casey; check in an attendee → the row flips to _Checked in_ with the time **with no refresh**.
- Scan a QR → **Done** → re-scan the **same** QR → the card comes back.
- Scan attendee A → **Done** → scan attendee B → B's card shows immediately.
- As a facilitator **not** on the event's team: `/api/checkin` and `/api/checkin/lookup` return `403`.

Attendee pass:

- On a **phone viewport** (devtools) and desktop, open `/tickets/<ticketId>` for Alex's seeded ticket: large QR + code, event details, Registered banner.
- With Alex's pass open on one device and the kiosk on another, check Alex in at the kiosk → the pass flips to _Checked in_ + time **live** (no refresh).
- Deep-link refresh of `/tickets/<ticketId>` still resolves the ticket.
- A different attendee's URL returns "Ticket not found".

### 4. Update `CHANGELOG.md`

Meaningful user-facing changes, under `Unreleased`:

- `### Fixed`: kiosk attendee table now updates live without a refresh; the scanner re-arms after a card is cleared; kiosk check-in restricted to the event's assigned staff.
- `### Added`: a mobile boarding-pass ticket page that shows live check-in status.

### 5. Isolate sanity (if available)

```
pnpm cf:preview
```

Smoke the pass page and the kiosk under workerd. If the environment cannot run it, say so in the PR body — the realtime path is a WebSocket the app already uses.

## Commits

Squash-friendly, per-sheet (already made):

- `feat: grant staff and ticket holders a scoped TICKET read for realtime` (sheet 01)
- `test: pin the kiosk check-in realtime subscription` (sheet 02)
- `fix: restrict kiosk check-in to the event's assigned staff` (sheet 03)
- `fix: allow re-scanning a QR after the kiosk card is cleared` (sheet 04)
- `feat: add a single-ticket detail endpoint` (sheet 05)
- `feat: add a live boarding-pass ticket page` (sheet 06)

Commit bodies say **why**, not what: realtime runs the caller's SELECT policy per row and `authenticated` had none; the dedupe tombstone survived Done; the mutating routes must not be wider than the delivery path; the pass is the attendee-facing consumer of the same read.

## Done when

- All four gates pass clean.
- `db:reset` replays the full migration chain without error and the TICKET grant/policy are present.
- Manual QA above passes, including the two live-update directions.
- CHANGELOG updated; branch pushed (or PR opened) referencing issue #266.
