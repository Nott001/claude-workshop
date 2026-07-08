# Phase 7 — QA & Validation

## Output File
`context/qa-validation.md`

## Objective
Define test coverage, unit and integration tests, edge cases, and acceptance criteria per implemented feature. Write to `context/qa-validation.md`.

## Required Outputs per Feature
- **Functional tests**: happy-path per role-relevant action (from Phase 1 permission matrix).
- **Edge cases**, examples by domain:
  - Commerce: duplicate HitPay webhook delivery, payment marked paid but ticket generation fails mid-transaction, refund after check-in.
  - Ticketing/Kiosk: re-scan of already checked_in ticket, scan of cancelled ticket, offline kiosk during scan.
  - Live Session: organizer advances lesson while attendee client disconnected/reconnecting, concurrent updates to LIVE_SESSION_STATE from two admins.
  - Chat: message sent to an event with no active session, moderation/delete of a live_qa message.
  - Surveys: duplicate submission attempt (should be blocked by unique constraint), partial answer submission.
- **Role-based permission checks**: for every screen/action in Phase 4, verify disallowed roles are blocked at both UI and API layer.
- **Acceptance criteria**: pass/fail conditions tied directly to the feature's Phase 6 Deliverable.

## Constraints
- Test plans reference existing business rules (Phase 1) and validation logic (Phase 3) — do not invent new business logic here, only verify it.

## Acceptance Criteria
- Every business rule from Phase 1 has ≥1 corresponding test case.
- Every permission-matrix "deny" cell has a corresponding negative test.
- Edge cases cover at minimum: duplicate/replay, concurrency, and invalid-state transitions per feature.
