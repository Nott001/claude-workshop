# Build Phase 7 — Kiosk Check-in Flow

## Context

At the venue, a facilitator operates a kiosk device to scan attendee QR tickets and mark them as checked in. The kiosk is a single-purpose, full-screen web page that accepts QR input (via camera scan or manual text entry) and validates the ticket status. This phase depends on Phase 4 (tickets with QR tokens must exist).

## Objective

Build the kiosk check-in flow: kiosk screen with QR input; check-in API that validates and updates ticket status; check-in confirmation/rejection UI; checked-in attendee list view.

## Scope

- No new database tables — uses existing TICKETS (status, qr_token, checked_in_by, updated_at)
- API routes:
  - `POST /api/checkin` — verify and check in a ticket
    - Input: `{ qr_token }` (from scan or manual entry)
    - Lookup TICKET by `qr_token`
    - If `status = checked_in`: return `{ status: 'duplicate', ticket }`
    - If `status = cancelled`: return `{ status: 'rejected', reason: 'cancelled' }`
    - If `status = issued`: update to `checked_in`, set `checked_in_by` from session user; return `{ status: 'success', attendee }`
    - Log check-in to EMAIL_LOGS (placeholder — actual email send in Phase 9)
  - `GET /api/checkin/[eventId]/attendees` — list checked-in attendees (facilitator)
- Screens:
  - `/kiosk` — full-screen kiosk page (facilitator-only)
    - QR scanner input area (with camera stream if browser supports `getUserMedia`)
    - Manual QR token text input fallback
    - Result overlay: success (green) / duplicate (yellow) / rejected (red)
    - Auto-clear result after 3 seconds for rapid scanning
  - `/kiosk/[eventId]/attendees` — checked-in attendee list
    - Table: name, email, checked_in_at
    - Real-time updates via Supabase Realtime subscription on TICKETS updates for this event; requires Realtime enabled on the `TICKETS` table
- `modules/kiosk/` domain logic:
  - QR token lookup with single-row fetch (unique index on `qr_token`)
  - Status transition guard: only `issued → checked_in` allowed
  - Duplicate detection returns informative message, not error
- Auto-refresh: kiosk page stays on scanner after each check-in (no navigation)

## Constraints

- Kiosk route is facilitator-only; no attendee login required for check-in operation
- QR scanner uses native browser APIs (no third-party SDK); fallback to manual input if camera unavailable
- No attendee sees the kiosk page or check-in list
- Kiosk must handle rapid sequential scans (multiple attendees in quick succession)

## Deliverable

- Facilitator opens `/kiosk`, scans an attendee's QR, sees success confirmation
- Scanning the same QR again shows "Already checked in" (yellow)
- Scanning a cancelled ticket shows "Ticket cancelled" (red)
- Facilitator can view the list of checked-in attendees with real-time updates

## Acceptance Criteria

- [ ] Scanning a valid QR with status `issued` marks the ticket `checked_in` and shows green success
- [ ] Scanning the same QR again shows duplicate warning and does not change status
- [ ] Manual QR text entry produces the same results as camera scan
- [ ] Check-in list shows all checked-in attendees for the selected event
- [ ] New check-in appears in the list in real time without page refresh
- [ ] Facilitator-only guard prevents non-facilitator access to `/kiosk`
