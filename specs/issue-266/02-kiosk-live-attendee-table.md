# 02 — Keep the kiosk attendee table live (no refresh)

## Goal

After sheet 01, checking in an attendee on the kiosk immediately flips their row in the right-hand attendee table — no page refresh. This sheet applies the migration to the local DB, verifies the behavior, and pins the subscription contract with a unit test.

## Why

The subscription already existed (`AttendeesPanel` → `subscribeToCheckins(eventId, …)` → bumps a `refreshKey` that re-fetches the table). The defect was upstream: no `authenticated` read policy on `TICKET`, so Realtime dropped every event before the panel ever saw it. Sheet 01 removed that blocker; this sheet proves it and locks the subscription down so it cannot silently regress.

## Prerequisites

- Sheet 01 applied and committed.
- Local Supabase stack available (`supabase` CLI; `pnpm db:start` if it is not already up).

## Steps (in order)

### 1. Replay the migration

`pnpm db:reset` runs `scripts/confirm-supabase-reset.mjs`, which prompts `[y/N]`; provide `y`:

```
printf 'y\n' | pnpm db:reset
```

Confirm the policy and grant landed:

```
npx supabase db shell "\d TICKET"        # GRANT ... TO authenticated; SELECT policy present
npx supabase db shell "SELECT * FROM pg_policies WHERE tablename = 'TICKET' AND policyname = 'Staff and ticket holders read tickets';"
```

### 2. Add the subscription contract test

New file `test/realtime-checkins.test.ts`, mirroring `test/qa-realtime.test.ts` (mock `@/shared/db/browser-client`, capture the `postgres_changes` handler, drive it directly):

- subscribes to `postgres_changes` with `event: "UPDATE"`, `table: "TICKET"`, `filter: "event_id=eq.<eventId>"`;
- uses a channel name starting with `checkins-<eventId>`;
- calls the callback **only** when `payload.new.status === "checked_in"` — an `UPDATE` to any other status must not trigger a refetch;
- tears down through the shared `unsubscribe` (`removeChannel`).

## Verification

### 3. Live check

With the app running (`pnpm dev`), sign in as the seeded **Casey Facilitator** (`facilitator@example.com` / `dev-password-123`) — the seed assigns Casey to the active `Product Summit 2026` event (see `supabase/seed.sql` `EVENT_FACILITATOR`).

1. Open `/staff/events/<event id>/kiosk`.
2. Note an attendee's row on the right (e.g. one of the seeded tickets for the event).
3. Type or scan that attendee's QR token → confirm the check-in.
4. **Expected:** the row flips to _Checked in_ and shows the time **without** touching the browser's refresh, within ~a second.

### 4. Contingency — `REPLICA IDENTITY`

If step 3 still stays stale, the event is being filtered out before it reaches the client. Supabase Realtime matches the channel filter (`event_id=eq.X`) against the broadcast payload; with default replica identity an `UPDATE` that does not change `event_id` may broadcast only changed columns. Then add a follow-up migration (do **not** edit `00008`):

```sql
-- TICKET rows are broadcast with all columns so the event_id channel filter
-- matches even when the UPDATE does not change event_id.
ALTER TABLE "public"."TICKET" REPLICA IDENTITY FULL;
```

Replay (`pnpm db:reset`) and repeat step 3. Do not add this unless it is actually needed — full replica identity grows WAL volume for every TICKET write.

## Verification gates (run before committing this sheet)

```
pnpm test -- test/realtime-checkins.test.ts
pnpm typecheck
pnpm lint
pnpm format
```

Commit as `test: pin the kiosk check-in realtime subscription`. Body: the subscription is the kiosk's live-update contract, and sheet 01 only works because this exact filter and status guard survive.
