# Scope Document

## Purpose Statement

A unified platform for running live, course-aligned events end-to-end — replacing the fragmented workflow of Zoom webinars, spreadsheet registrations, manual ticketing, and disconnected Q&A with a single system that handles registration, payment, check-in, real-time session delivery, content progression tracking, and post-event feedback.

## User Roles

| Role | Responsibility |
|---|---|
| **Attendee** | Registers, purchases ticket, checks in, consumes live lesson content, participates in Q&A, completes post-event surveys |
| **Speaker** | Delivers live lessons, views attendee Q&A, advances session state (current lesson) in the room |
| **Facilitator** | Creates and manages events (including pricing), assigns speakers, configures course content, oversees check-in kiosk, monitors live sessions, accesses all data |

## Core Workflows

- Event creation & speaker assignment
- Ticket purchase → payment (HitPay) → QR issuance
- Kiosk check-in (on-site, facilitated)
- Live session room (lesson broadcast + Q&A + support chat)
- Course content consumption + progress tracking
- Post-event survey

## MVP Scope

A single event can be run end-to-end without manual database edits:

1. **Event Management** — Facilitator creates an event (with title, date, venue, and price), links it to a course (modules → lessons), assigns speakers, and publishes it when ready (draft → active → complete lifecycle).
2. **Registration & Ticketing** — Attendee registers, purchases a ticket via HitPay, and receives a unique QR token.
3. **Check-in Kiosk** — Facilitator scans or verifies QR at the venue to mark the ticket as checked in.
4. **Live Session Room** — Speaker broadcasts the current lesson to all attendees in real time; attendees see the lesson content and can submit questions via Q&A chat and support chat.
5. **Content Progression** — Attendees mark lesson units as completed; progress is tracked per user per lesson.
6. **Post-Event Survey** — Facilitator creates a survey with text, multiple-choice, and rating questions; attendees submit one response per survey.
7. **Email Notifications** — Key lifecycle events (registration confirmation, ticket issued, check-in) are logged; email sending infrastructure is wired.

## Out of Scope (v1)

| Item | Justification |
|---|---|
| Multi-role users (single user with attendee + speaker hats) | Requires join table & permission model; low frequency for v1 |
| Recurring / series events | Each event is a standalone instance; schedule & recurrence adds complexity without core validation |
| Refund automation | Requires HitPay refund API integration + admin UI; low volume post-event |
| Analytics dashboards | Read-only slice possible but not critical for event execution |
| Multi-language / i18n | Adds translation pipeline for UI + content; scope creep |
| Attendee-to-attendee DM / peer chat | Multi-user chat adds complexity without event-critical benefit |
| Per-user read receipts in chat | Requires join table; deferred to post-MVP |
| Offline / PWA mode | Network assumed for live session; offline fallback is nice-to-have |
| Speaker self-registration / portal | Speakers are assigned by facilitator; self-service adds auth flows |
| Survey result aggregation / export | Facilitator can view responses in-app; CSV export deferred |

## Success Criteria

- A facilitator can create an event (with pricing), link a course, assign speakers, and publish it entirely through the UI.
- An attendee can register, pay via HitPay, receive a QR ticket, and check in at the kiosk.
- A speaker can open the live session room, advance lessons, and see Q&A from attendees.
- An attendee can see the current lesson, complete units, and submit a post-event survey.
- All key lifecycle events are persisted in email logs.
- No manual database edits are required to run a single event from registration through survey.
