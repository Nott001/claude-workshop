# Phase 1 — Functional Planning

## User Stories

### Workflow: Event Creation & Speaker Assignment

| Role | Story |
|---|---|
| Facilitator | As a **facilitator**, I want to **create an event with a title, date, time, and venue**, so that **attendees know where and when the event takes place**. |
| Facilitator | As a **facilitator**, I want to **link an existing course (modules → lessons) to an event**, so that **the event has structured content for the live session**. |
| Facilitator | As a **facilitator**, I want to **set a price and currency for an event**, so that **attendees are charged correctly at checkout**. |
| Facilitator | As a **facilitator**, I want to **assign speakers to an event from existing speaker profiles**, so that **the right people are responsible for delivering lessons**. |
| Facilitator | As a **facilitator**, I want to **create or update a speaker profile with bio and photo**, so that **attendees can see who the speakers are**. |
| Facilitator | As a **facilitator**, I want to **create a course with modules and lessons before linking it to an event**, so that **content is ready when the event is published**. |

### Workflow: Ticket Purchase → Payment → QR Issuance

| Role | Story |
|---|---|
| Attendee | As an **attendee**, I want to **browse available events and register**, so that **I can express intent to attend**. |
| Attendee | As an **attendee**, I want to **purchase a ticket via HitPay**, so that **I can pay for the event online**. |
| Attendee | As an **attendee**, I want to **receive a unique QR ticket after payment**, so that **I can check in at the venue**. |
| Facilitator | As a **facilitator**, I want to **view payment status and amount for each registrant**, so that **I can confirm who has paid and how much**. |

### Workflow: Kiosk Check-in

| Role | Story |
|---|---|
| Facilitator | As a **facilitator**, I want to **scan or enter an attendee's QR token at the kiosk**, so that **I can mark them as checked in**. |
| Facilitator | As a **facilitator**, I want to **see an alert if a QR token has already been scanned**, so that **I can prevent duplicate check-in**. |
| Facilitator | As a **facilitator**, I want to **view a list of checked-in attendees**, so that **I can track venue capacity and attendance**. |

### Workflow: Live Session Room

| Role | Story |
|---|---|
| Speaker | As a **speaker**, I want to **set the current lesson in the live session room**, so that **all attendees see the same lesson content**. |
| Speaker | As a **speaker**, I want to **advance to the next lesson when ready**, so that **the session flows naturally**. |
| Attendee | As an **attendee**, I want to **see the current lesson content (PDF/video/image/link) in real time**, so that **I can follow along with the speaker**. |
| Attendee | As an **attendee**, I want to **submit questions via the live Q&A channel**, so that **I can get clarifications during the session**. |
| Speaker | As a **speaker**, I want to **see incoming Q&A messages**, so that **I can address attendee questions**. |
| Facilitator | As a **facilitator**, I want to **monitor the live Q&A and support channels**, so that **I can moderate messages if needed**. |

### Workflow: Course Content Consumption + Progress Tracking

| Role | Story |
|---|---|
| Attendee | As an **attendee**, I want to **view all lessons in the course**, so that **I can browse the full content structure**. |
| Attendee | As an **attendee**, I want to **mark lesson units as completed**, so that **my progress is saved across sessions**. |
| Attendee | As an **attendee**, I want to **see my overall progress in the course**, so that **I know what I've completed**. |
| Facilitator | As a **facilitator**, I want to **view attendee progress data**, so that **I can see engagement levels**. |

### Workflow: Post-Event Survey

| Role | Story |
|---|---|
| Facilitator | As a **facilitator**, I want to **create a survey with text, multiple-choice, and rating questions**, so that **I can collect structured feedback**. |
| Attendee | As an **attendee**, I want to **submit one response per survey**, so that **my feedback is recorded**. |
| Attendee | As an **attendee**, I want to **see that my survey has been submitted**, so that **my feedback was received**. |
| Facilitator | As a **facilitator**, I want to **view survey responses per attendee**, so that **I can evaluate feedback**. |

---

## Permission Matrix

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| Register account | Allowed | Allowed | Allowed |
| Create / update course | Denied | Denied | Allowed |
| Create / update modules & lessons | Denied | Denied | Allowed |
| Create event | Denied | Denied | Allowed |
| Update event details | Denied | Denied | Allowed |
| Set event price and currency | Denied | Denied | Allowed |
| Create / update speaker profile | Denied | Allowed (own only) | Allowed (any) |
| Assign speakers to event | Denied | Denied | Allowed |
| View event list | Allowed | Allowed | Allowed |
| View event detail | Allowed | Allowed | Allowed |
| Register for event | Allowed | Denied | Denied |
| Purchase ticket (create payment) | Allowed | Denied | Denied |
| View own ticket / QR | Allowed | Denied | Allowed (all) |
| View payment status | Allowed (own) | Denied | Allowed (all) |
| Check in attendee (kiosk) | Denied | Denied | Allowed |
| View check-in list | Denied | Denied | Allowed |
| Set current lesson in live room | Denied | Allowed | Allowed |
| View live lesson content | Allowed | Allowed | Allowed |
| Post Q&A message | Allowed | Allowed | Allowed |
| Post support message | Allowed | Allowed | Allowed |
| Moderate / delete chat messages | Denied | Denied | Allowed |
| View lesson units & content | Allowed | Allowed | Allowed |
| Mark lesson units completed | Allowed (own) | Denied | Denied |
| View own progress | Allowed | Denied | Denied |
| View any user's progress | Denied | Denied | Allowed |
| Create survey | Denied | Denied | Allowed |
| Submit survey response | Allowed (once) | Denied | Denied |
| View survey responses | Denied | Denied | Allowed |
| View email logs | Denied | Denied | Allowed |

---

## Status Enums (Confirmed & Extended)

| Entity | Field | Values | Notes |
|---|---|---|---|
| PAYMENTS | status | `pending`, `paid`, `failed`, `refunded` | No change needed |
| TICKETS | status | `issued`, `checked_in`, `cancelled` | No change needed |
| CHAT_MESSAGES | channel | `support`, `live_qa` | No change needed |
| SURVEY_QUESTIONS | submitted_type | `text`, `multiple_choice`, `rating` | No change needed |
| USERS | role | `attendee`, `speaker`, `facilitator` | No change needed |
| EMAIL_LOGS | email_type | *(to be defined — at minimum: `registration_confirmation`, `ticket_issued`, `check_in_confirmed`)* | Requires enum values; schema gap |
| EMAIL_LOGS | status | *(to be defined — at minimum: `sent`, `failed`)* | Requires enum values; schema gap |

---

## Business Rules

### Payments & Ticketing

1. A ticket can only be issued after `PAYMENTS.status = paid`.
2. `qr_token` is single-use; scanning a ticket with `TICKETS.status = checked_in` must be rejected and flagged.
3. `PAYMENTS.hitpay_reference_id` must be unique across all payments.
4. A user can only have one active (non-cancelled) ticket per event.
5. `TICKETS.cancelled` status transitions: can only cancel an `issued` or `checked_in` ticket (not already cancelled).
6. `PAYMENTS.status` transition: `pending → paid | failed`, `paid → refunded` only.
7. `EVENTS.price` must be non-negative.
8. `PAYMENTS.amount` and `PAYMENTS.currency` are snapshotted from the event's `price` and `currency` at payment creation time, so the charged amount is immutable even if the event price changes later.

### Live Session

7. `LIVE_SESSION_STATE.current_lesson_id` must reference a lesson within the module tree of the event's linked course.
8. Only one `LIVE_SESSION_STATE` row may exist per event (singleton enforced by PK).
9. `LIVE_SESSION_STATE.updated_by` must reference a user with `role = speaker` or `role = facilitator`.

### Chat

10. `CHAT_MESSAGES.channel` is restricted to `support` or `live_qa`.
11. Attendees and speakers may only send messages; facilitators may additionally delete any message (moderation). Deletion (soft or hard) is not in the current schema — implement as needed.

### Content & Progress

12. `units_completed` in `LESSON_PROGRESS` must be ≤ `LESSONS.total_units`.
13. `LESSON_PROGRESS.is_completed` should be automatically set to `TRUE` when `units_completed = total_units`.
14. A lesson must belong to a module that belongs to the course linked to the event for progress tracking to apply in an event context.

### Survey

15. A user may have at most one `SURVEY_RESPONSES` row per `(survey_id, user_id)` — enforced by unique constraint; resubmission is denied.
16. Rating questions (`submitted_type = rating`) must have `answer_value` in range 1–5.
17. Multiple-choice questions (`submitted_type = multiple_choice`) use `answer_text`; rating questions use `answer_value`; text questions use `answer_text`.

### General

18. A user's `role` is set on creation and may be updated by a facilitator. Role change does not cascade to existing FK references.
19. `COURSE` to `EVENTS` is strictly 1-to-0-or-1: an event may optionally consume a course, and a course may be consumed by at most one event.

---

## Feature Priority Split

| Priority | Feature | Notes |
|---|---|---|
| Must-have | Event CRUD (facilitator) | Core enabler |
| Must-have | Course / module / lesson CRUD (facilitator) | Content backbone |
| Must-have | Speaker profile CRUD + assignment | Speaker workflow |
| Must-have | Event registration + HitPay payment flow | Attendee entry point |
| Must-have | QR ticket generation and display | Physical check-in |
| Must-have | Kiosk check-in (scan QR, mark checked-in) | Venue gate |
| Must-have | Live session room with current lesson broadcast | Core real-time feature |
| Must-have | Live Q&A chat channel | Audience engagement |
| Must-have | Lesson content display (PDF/video/image/link) | Content delivery |
| Must-have | Lesson progress tracking | Self-paced tracking |
| Must-have | Post-event survey creation (facilitator) | Feedback collection |
| Must-have | Survey submission (attendee) | Feedback submission |
| Must-have | Email logging | Audit trail |
| Must-have | Support chat channel (separate from Q&A) | Attendee-to-facilitator messaging for event issues |
| Nice-to-have | Check-in attendee list view | Facilitator convenience |
| Nice-to-have | Survey response browsing (facilitator) | Data visibility |
| Nice-to-have | Chat message moderation (delete) | Content policy |
| Nice-to-have | Attendee progress view (facilitator) | Engagement insights |

---

## Acceptance Criteria Checklist

- [x] Every MVP workflow has ≥1 user story per involved role.
- [x] Permission matrix has no blank cells (explicit allow/deny).
- [x] All status enums match schema enums exactly.
- [x] Gaps requiring schema changes are flagged (EMAIL_LOGS enums).
