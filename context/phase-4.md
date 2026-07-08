# Phase 4 — UX & Screen Planning

## Output File
`context/ux-screens.md`

## Objective
Define screens, per-role actions, navigation, and form requirements. Write to `context/ux-screens.md`.

## Required Outputs
- **Screen list by module** (reference Phase 2 module list):
  - Auth: sign-in/sign-up (Clerk-hosted or embedded)
  - Course Content: course/module/lesson browser, lesson viewer with progress tracker
  - Events: event listing, event detail (venue, speakers, schedule), and course
  - Live Session Room: attendee view (current lesson + live_qa channel), organizer/speaker control view (advance lesson, moderate Q&A)
  - Commerce: checkout (HitPay handoff), ticket/QR display (wallet-style)
  - Kiosk: attendee lookup/scan, check-in confirmation (organizer/admin-operated device)
  - Chat: support channel (attendee ↔ organizer), live_qa (attendee ↔ speaker/organizer moderation)
  - Surveys: post-event survey form, response confirmation
  - Admin: user/role management, speaker profile management, event CRUD
- **Per-role actions per screen**: derive directly from Phase 1 permission matrix — do not redefine permissions here, only surface them as UI affordances (buttons/fields shown or hidden).
- **Navigation logic**: role-based entry points (e.g., student lands on course/event list; organizer lands on event management dashboard; kiosk is a locked single-purpose device view).
- **Form requirements**: fields, validation, required vs optional, per form (checkout, survey response, event creation, speaker profile).

## Constraints
- No visual design system, styling, or component library decisions here (defer to build phase / frontend-design conventions).
- Screens must only expose actions already permitted in Phase 1's matrix.

## Acceptance Criteria
- Every module from Phase 2 has ≥1 screen.
- Every permission-matrix "allow" cell has a corresponding UI affordance somewhere in the screen list.
- Kiosk flow is a self-contained subset (no dependency on attendee's personal login).
