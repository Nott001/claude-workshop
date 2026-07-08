# Build Phase 9 — Email Notifications

## Context

Key lifecycle events (registration, ticket issuance, check-in) must be logged and trigger transactional email sends via Brevo. This is the final build phase because it depends on all prior modules: registration (Phase 4), ticket issuance (Phase 4), check-in (Phase 7), survey events (Phase 8), and live session events (Phase 5). The email logs provide an audit trail for all communications.

## Objective

Build the email notification subsystem: EMAIL_LOGS table migration; Brevo client integration; email sending triggered by lifecycle events; facilitator email log browser with filtering.

## Scope

- Database migration: EMAIL_LOGS table (log_id, user_id, email_type, status, sent_at, created_at, updated_at per data-model.md)
- `lib/email/` — Brevo client wrapper:
  - Send transactional email via Brevo API
  - Templates: registration confirmation, ticket issued, check-in confirmed (inline HTML or Brevo template IDs)
  - Error handling: catch send failures, log with `status = failed`
- Email triggers (wired into existing API routes — no new endpoints for trigger):
  - **Registration confirmation**: after `POST /api/payments` creates a payment (attendee registered intent)
  - **Ticket issued**: after HitPay webhook processes `paid` and creates ticket
  - **Check-in confirmed**: after `POST /api/checkin` marks ticket `checked_in`
- API routes:
  - `GET /api/logs` — list email logs (facilitator only); supports filtering by `email_type`, `status`, `user_id`, date range
  - `GET /api/logs/[id]` — single log detail (facilitator only)
- Screen:
  - `/dashboard/logs` — email log browser (facilitator)
    - Table: user, email type, status, sent_at
    - Filters: by type (dropdown), by status (dropdown), by date range
    - Sort by `sent_at` descending by default
- `modules/notifications/` domain logic:
  - Log creation always happens before or simultaneously with the send call
  - Failed sends are logged with `status = failed`; no automatic retry in MVP
  - Email sending is fire-and-forget from the API handler (non-blocking — `Promise.allSettled` or background queue)

## Constraints

- Email sending must never block the API response — use fire-and-forget pattern
- Brevo API key in env only; never hardcoded or logged
- No email template editing UI in MVP; templates are static or managed via Brevo dashboard
- Email logs are append-only; no deletion endpoint
- If Brevo is down, the API route must still respond successfully (email send failure is non-critical)

## Deliverable

- Registration intent triggers a confirmation email log
- Successful payment triggers ticket-issued email log
- Kiosk check-in triggers check-in-confirmed email log
- Facilitator can browse all email logs with filtering
- Email send failures are recorded but do not break the API response

## Acceptance Criteria

- [ ] After a successful payment, an email log entry with `email_type = ticket_issued` appears in the logs
- [ ] The corresponding email is sent via Brevo (verify in Brevo dashboard or send log)
- [ ] Kiosk check-in creates a `check_in_confirmed` email log entry
- [ ] Facilitator filters logs by `email_type` and sees only matching entries
- [ ] If Brevo API key is invalid, the API route still returns success and the log entry has `status = failed`
- [ ] `/dashboard/logs` is accessible only to facilitators
