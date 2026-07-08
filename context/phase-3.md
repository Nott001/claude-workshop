# Phase 3 — Data Model Planning

## Output File
`context/data-model.md`

## Objective
Finalize the schema from OVERVIEW.md into an implementation-ready DB design. Write to `context/data-model.md`. Do not edit OVERVIEW.md — it is the system summary; the detailed design lives in the output file.

## Required Outputs
- **Entity/field finalization**: confirm types, nullability, defaults for every table listed in OVERVIEW.md §2.
- **Audit fields**: add `created_at`/`updated_at` to tables missing them (currently only USERS, LIVE_SESSION_STATE, CHAT_MESSAGES, PAYMENTS, TICKETS, SURVEYS, SURVEY_RESPONSES have timestamps — decide which others need them, e.g. LESSON_PROGRESS, TICKETS.updated_at for status transitions).
- **Validation logic** per entity, e.g.:
  - EVENTS.start_time < EVENTS.end_time
  - TICKETS.qr_token generated only on PAYMENTS.status = paid
  - LESSON_PROGRESS.units_completed ≤ LESSONS.total_units
  - SURVEY_ANSWERS: exactly one of (answer_text, answer_value) populated depending on SURVEY_QUESTIONS.submitted_type
- **Resolve open schema gaps**:
  - CHAT_MESSAGES.read_by (single FK) vs. per-user read receipts — decide: keep as "last read by" pointer (simple, lossy) or add `MESSAGE_READS(message_id, user_id, read_at)` join table (accurate, more writes). Recommend based on MVP scope.
  - Confirm EVENT_SPEAKERS needs no extra fields (e.g., speaking_order, session_time) — flag if Phase 1 stories require it.
- **Indexes**: qr_token, clerk_id, hitpay_reference_id (all UK, auto-indexed) — flag any additional lookup patterns from Phase 2 data flows needing composite indexes (e.g., CHAT_MESSAGES(event_id, channel, sent_at) for live Q&A pagination).

## Constraints
- Do not add entities beyond what Phase 1 business rules require — no speculative tables.
- Preserve existing table/field names from OVERVIEW.md unless a rule forces a change; document any rename.

## Acceptance Criteria
- Every business rule from Phase 1 maps to a validation constraint or trigger.
- Every table has explicit nullability and default values.
- Schema gap decisions (read receipts, etc.) are recorded with a one-line rationale.
