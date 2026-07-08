# Phase 1 — Functional Planning

## Objective
Translate Phase 0 scope into user stories, permission matrix, statuses, and business rules. Write it in a corresponding markdown file.

## Required Outputs
- **User stories**: format `As a <role>, I want <action>, so that <outcome>`. Group by workflow (from Phase 0 list).
- **Permission matrix**: rows = actions (create event, assign speaker, issue ticket, check in attendee, post chat, moderate Q&A, view survey results, etc.), columns = roles, cells = allowed/denied.
- **Status enums to formalize** (already partially defined in schema — confirm/extend):
  - PAYMENTS.status: pending, paid, failed, refunded
  - TICKETS.status: issued, checked_in, cancelled
  - CHAT_MESSAGES.channel: support, live_qa
  - SURVEY_QUESTIONS.submitted_type: text, multiple_choice, rating
- **Business rules**, e.g.:
  - A ticket can only be issued after PAYMENTS.status = paid.
  - qr_token is single-use; re-scan after checked_in must be rejected/flagged.
  - LIVE_SESSION_STATE.current_lesson_id must reference a lesson within the module tree of the event's linked course.
  - SURVEY_RESPONSES unique per (survey_id, user_id) — resubmission not allowed.
- **Feature priority split**: must-have vs nice-to-have, referencing Phase 0 MVP scope.

## Constraints
- Do not specify UI or architecture.
- Every business rule must be enforceable against the existing schema (Section 2 of OVERVIEW.md); flag rules that require new fields/tables.

## Acceptance Criteria
- Every MVP workflow from Phase 0 has ≥1 user story per involved role.
- Permission matrix has no blank cells (explicit allow/deny only).
- All status enums used in rules match schema enums exactly.
