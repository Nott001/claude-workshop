# Phase 2 — Architecture & Module Planning

## Output File
`context/architecture.md`

## Objective
Define system modules, stack, data flow, and implementation order. Write to `context/architecture.md`.

## Required Outputs
- **Modules** (map 1:1 to schema domains):
  - Identity/Auth (Clerk integration, role assignment)
  - Course Content (MODULES, LESSONS, LESSON_PROGRESS)
  - Event Management (EVENTS, EVENT_SPEAKERS, SPEAKER_PROFILES, COURSE)
  - Live Session Room (LIVE_SESSION_STATE + real-time sync layer)
  - Chat/Q&A (CHAT_MESSAGES, both channels)
  - Commerce (PAYMENTS via HitPay, TICKETS + QR)
  - Kiosk/Check-in (ticket lookup, QR scanning, checked_in_by write)
  - Surveys (SURVEYS, SURVEY_QUESTIONS, SURVEY_RESPONSES, SURVEY_ANSWERS)
  - Notifications (EMAIL_LOGS)
- **Recommended stack**: Next.js, Tailwind and shadcn, Clerk, Websockets, Supabase, Brevo, HitPay, Clerk, Sentry, Statuscake
- **Data flow diagram (text form)**: request path for the two highest-risk flows — (1) payment → ticket issuance → QR check-in, (2) organizer advances lesson → LIVE_SESSION_STATE update → broadcast to all connected attendee clients.
- **Folder structure**: top-level only, mapped to modules above.

## Constraints
- No component-level code or DB migrations here.
- Real-time infra choice must be justified against: integration effort with chosen backend.

## Acceptance Criteria
- Every schema entity is owned by exactly one module.
- Real-time transport choice includes explicit reasoning against next-best alternative.
- Implementation order has no forward dependency violations (a module never depends on one scheduled later).
