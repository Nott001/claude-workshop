# Live Events Platform — System Overview

## 1. System Definition
Role-based platform for live events with:
- Assigned speakers per event
- Course-style content (modules → lessons) tied to an event
- Real-time session room state (current lesson broadcast to attendees)
- Live Q&A / support chat channels
- Ticketing + payment (HitPay) with QR check-in
- On-site kiosk for facilitator check-in
- Post-event surveys
- Email notification logging

**Roles:** `attendee | speaker | facilitator` (single enum on `USERS.role`, no multi-role join table — role changes require row update). Facilitator is the admin role.

**Identity:** Clerk-integrated. `USERS.clerk_id` is the auth source of truth; `user_id` is internal PK used for all FKs.

## 2. Data Model (condensed)

| Entity | Key Fields | Notes |
|---|---|---|
| USERS | user_id PK, full_name, email UK, clerk_id UK, role ENUM, created_at | Auth via Clerk |
| COURSE | course_id PK, course_name, course_description | 1 course → 0-1 event (UK on EVENTS.course_id) |
| MODULES | module_id PK, course_id FK, module_name, sequence_order | Each module is linked to a single course, and each module can hold several lessons related to that module (think of it as a topic) |
| LESSONS | lesson_id PK, module_id FK, description, content_type ENUM(pdf, video, image, link), content_url, total_units, sequence_order | `content_type` values: `pdf` (handout/slides), `video` (embedded video), `image` (diagram/poster), `link` (external article or video URL) |
| EVENTS | event_id PK, course_id FK/UK, title, event_date, start_time, end_time, venue_address, venue_name, lat, lng, price NUMERIC(10,2), currency CHAR(3), status ENUM(draft,active,complete) | price defaults to 0, currency defaults to 'PHP'; CHECK price >= 0; status defaults to 'draft' |
| LIVE_SESSION_STATE | event_id PK/FK, current_lesson_id FK, updated_by FK, updated_at | Singleton per event; drives real-time room sync |
| LESSON_PROGRESS | lesson_id PK/FK, user_id PK/FK, units_completed, is_completed | Composite PK |
| CHAT_MESSAGES | message_id PK, event_id FK, channel ENUM(support, live_qa), user_id FK, sent_at, read_by FK | |
| PAYMENTS | payment_id PK, user_id FK, event_id FK, hitpay_reference_id UK, status ENUM(pending, paid, failed, refunded), paid_at, amount NUMERIC(10,2), currency CHAR(3) | amount defaults to 0, currency defaults to 'PHP'; CHECK amount >= 0 |
| TICKETS | payment_id PK/FK, user_id FK, event_id FK, qr_token UK, status ENUM(issued, checked_in, cancelled), issued_at, checked_in_by FK | 1:1 with PAYMENTS |
| SPEAKER_PROFILES | speaker_profile_id PK, user_id FK/UK, bio, photo_url, designation ENUM | |
| EVENT_SPEAKERS | event_id PK/FK, speaker_profile_id PK/FK | Join table, composite PK |
| SURVEYS | survey_id PK, event_id FK, title, created_at | |
| SURVEY_QUESTIONS | question_id PK, survey_id FK, question_text, submitted_type ENUM(text, multiple_choice, rating), sequence_order | |
| SURVEY_RESPONSES | response_id PK, survey_id FK, user_id FK | UK(survey_id, user_id) — one response per user per survey |
| SURVEY_ANSWERS | answer_id PK, response_id FK, question_id FK, answer_text, answer_value | |
| EMAIL_LOGS | log_id PK, user_id FK, email_type ENUM, status | |

**Pricing model:** Each event has a `price` and `currency` set by the facilitator. When a payment is initiated, the `amount` and `currency` from the event are snapshotted into the PAYMENTS record so the charged amount is immutable even if the event price changes later.

**Relationship notes:**
- COURSE 1—0..1 EVENTS (a course optionally has one live event)
- EVENTS 1—0..1 LIVE_SESSION_STATE
- LESSONS 1—0..* LIVE_SESSION_STATE.current_lesson_id
- USERS 1—* on: LESSON_PROGRESS, CHAT_MESSAGES (sender + reader, 2 FKs), PAYMENTS, TICKETS (owner + checked_in_by, 2 FKs), SURVEY_RESPONSES, EMAIL_LOGS
- USERS 1—0..1 SPEAKER_PROFILES; SPEAKER_PROFILES *—* EVENTS via EVENT_SPEAKERS

**Open schema question:** `CHAT_MESSAGES.read_by` as a single int FK cannot represent per-user read receipts for a broadcast channel — likely needs a join table (`message_id, user_id, read_at`) if read-state per attendee is required. Flag for Phase 3.

## 3. Agent Operating Contract

**Method:** Phased delivery, MVP-first, no speculative features, must-have vs nice-to-have split maintained across phases. Scope approved in an earlier phase is preserved unless explicitly revised.

**Constraints on every task:**
- One feature per implementation task; no "build everything" / "fix all" style prompts.
- Full code generation only on explicit request; default output is planning artifacts.
- Do not modify parts of the system outside the requested feature, unless necessitated as the module is impacted by feature change.
- Minimize repeated context — reference prior decisions by name, don't restate them.

**Task-request output format (mandatory for all build steps):**
```
Context: <system + current phase>
Objective: <feature/output to produce now>
Scope: <must be included>
Constraints: <must not change / out of scope / must preserve>
Deliverable: <exact expected output>
Acceptance Criteria: <pass/fail conditions>
```

## 4. Phase Index
Each phase has its own spec sheet (`phase-0.md` … `phase-8.md`):

| # | Phase | File |
|---|---|---|
| 0 | Business & Scope Definition | phase-0.md |
| 1 | Functional Planning | phase-1.md |
| 2 | Architecture & Module Planning | phase-2.md |
| 3 | Data Model Planning | phase-3.md |
| 4 | UX & Screen Planning | phase-4.md |
| 5 | Build Planning | phase-5.md |
| 6 | Controlled Implementation | phase-6.md |
| 7 | QA & Validation | phase-7.md |
| 8 | Deployment & Handover | phase-8.md |
