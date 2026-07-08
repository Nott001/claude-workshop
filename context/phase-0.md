# Phase 0 — Business & Scope Definition

## Objective
Lock system purpose, user roles, MVP boundary, and success criteria before any design work.

## Required Outputs
- **Purpose statement**: 1-2 sentences, what problem this platform solves vs. running events on generic tools (Zoom + spreadsheets + manual ticketing).
- **User roles**: student, speaker, organizer, admin — one-line responsibility per role.
- **Core workflows** (name only, detail deferred to Phase 1):
  - Event creation & speaker assignment
  - Ticket purchase → payment → QR issuance
  - Kiosk check-in
  - Live session room (lesson broadcast + Q&A)
  - Course content consumption + progress tracking
  - Post-event survey
- **MVP scope**: features required for a single event to run end-to-end (register → pay → attend → check-in → participate → survey).
- **Out of scope (v1)**: explicitly list deferred items (e.g., multi-role users, recurring/series events, refund automation, analytics dashboards, multi-language).
- **Success criteria**: measurable (e.g., "organizer can run one live event start-to-finish without manual DB edits").

## Constraints
- Do not design schema, UI, or stack here — scope only.
- Every "in scope" item must map to an entity already in the data model, or be flagged as a schema gap.

## Acceptance Criteria
- Single-page scope doc: purpose, roles, MVP list, out-of-scope list, success criteria.
- No feature appears in both MVP and out-of-scope.
- Every out-of-scope item has one-line justification (cost/complexity/not core).
