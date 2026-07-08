# Phase 2 — Architecture & Module Planning

## Objective
Define system modules, stack, data flow, and implementation order. Write it in a corresponding markdown file.

## Required Outputs
- **Modules** (map 1:1 to schema domains):
  - Identity/Auth (Clerk integration, role assignment)
  - Course Content (COURSE, MODULES, LESSONS, LESSON_PROGRESS)
  - Event Management (EVENTS, EVENT_SPEAKERS, SPEAKER_PROFILES)
  - Live Session Room (LIVE_SESSION_STATE + real-time sync layer)
  - Chat/Q&A (CHAT_MESSAGES, both channels)
  - Commerce (PAYMENTS via HitPay, TICKETS + QR)
  - Kiosk/Check-in (ticket lookup, checked_in_by write)
  - Surveys (SURVEYS, SURVEY_QUESTIONS, SURVEY_RESPONSES, SURVEY_ANSWERS)
  - Notifications (EMAIL_LOGS)
- **Recommended stack**: frontend framework, backend/API layer, DB engine, real-time transport (e.g., Supabase Realtime or Firebase — pick one, note tradeoffs: managed WS infra, pricing model, existing Clerk/HitPay SDK compatibility), auth (Clerk), payments (HitPay), file/photo storage for speaker photos and lesson content_url.
- **Data flow diagram (text form)**: request path for the two highest-risk flows — (1) payment → ticket issuance → QR check-in, (2) organizer advances lesson → LIVE_SESSION_STATE update → broadcast to all connected attendee clients.
- **Folder structure**: top-level only, mapped to modules above.
- **Implementation order**: sequence modules by dependency (Identity → Course Content → Events → Commerce → Live Session/Chat → Kiosk → Surveys/Notifications), with rationale.

## Constraints
- No component-level code or DB migrations here.
- Real-time infra choice must be justified against: connection scaling at expected concurrent attendee count, cost, and integration effort with chosen backend.

## Acceptance Criteria
- Every schema entity is owned by exactly one module.
- Real-time transport choice includes explicit reasoning against next-best alternative.
- Implementation order has no forward dependency violations (a module never depends on one scheduled later).
