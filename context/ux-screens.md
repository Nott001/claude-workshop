# Phase 4 — UX & Screen Planning

## Screen List by Module

### Identity/Auth

| Screen | Route | Roles |
|---|---|---|
| Sign In | `/sign-in` | All (Clerk-hosted or embedded) |
| Sign Up | `/sign-up` | All |

### Course Content

| Screen | Route | Roles |
|---|---|---|
| Course List | `/courses` | Facilitator |
| Course Detail (modules tree) | `/courses/[id]` | Facilitator |
| Module / Lesson Editor | `/courses/[id]/modules/[id]` | Facilitator |
| Lesson Viewer | `/courses/[id]/lessons/[id]` | Attendee, Speaker, Facilitator |
| Progress Overview | `/courses/[id]/progress` | Attendee (own), Facilitator (all) |

### Event Management

| Screen | Route | Roles |
|---|---|---|
| Event List | `/events` | All |
| Event Detail | `/events/[id]` | All |
| Event Create / Edit | `/events/new`, `/events/[id]/edit` | Facilitator |
| Speaker Profile List | `/speakers` | Facilitator |
| Speaker Profile Edit | `/speakers/[id]/edit` | Facilitator, Speaker (own) |
| Speaker Assignment | `/events/[id]/speakers` | Facilitator |

### Commerce

| Screen | Route | Roles |
|---|---|---|
| Event Registration | `/events/[id]/register` | Attendee |
| Checkout (HitPay handoff) | `/checkout/[payment_id]` | Attendee |
| Ticket / QR Wallet | `/tickets` | Attendee |
| Payment Status | `/payments` | Attendee (own), Facilitator (all) |

### Live Session Room

| Screen | Route | Roles |
|---|---|---|
| Live Room (attendee view) | `/events/[id]/live` | Attendee, Speaker, Facilitator |
| Speaker Controls | embedded in `/events/[id]/live` | Speaker, Facilitator |

### Chat / Q&A

| Screen | Route | Roles |
|---|---|---|
| Live Q&A Panel | embedded in `/events/[id]/live` | Attendee, Speaker, Facilitator |
| Support Channel | `/events/[id]/support` | Attendee, Speaker, Facilitator |

### Kiosk / Check-in

| Screen | Route | Roles |
|---|---|---|
| Kiosk Scanner | `/kiosk` | Facilitator |
| Check-in Confirmation | `/kiosk/result` | Facilitator |
| Check-in List | `/kiosk/attendees` | Facilitator |

### Surveys

| Screen | Route | Roles |
|---|---|---|
| Survey List | `/events/[id]/surveys` | Facilitator |
| Survey Builder | `/events/[id]/surveys/new`, `/events/[id]/surveys/[id]/edit` | Facilitator |
| Survey Form | `/events/[id]/surveys/[id]` | Attendee |
| Survey Submitted Confirmation | `/events/[id]/surveys/[id]/confirmed` | Attendee |
| Survey Responses | `/events/[id]/surveys/[id]/responses` | Facilitator |

### Admin / Facilitator Dashboard

| Screen | Route | Roles |
|---|---|---|
| Dashboard (hub) | `/dashboard` | Facilitator |
| User Management | `/dashboard/users` | Facilitator |
| Email Logs | `/dashboard/logs` | Facilitator |

---

## Per-Role Actions Per Screen

### Sign In / Sign Up

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| Register new account | Visible | Visible | Visible |
| Sign in | Visible | Visible | Visible |

### Course List

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View course list | — | — | Visible |
| Create new course | — | — | Visible |
| Edit course | — | — | Visible (per row) |
| Delete course | — | — | Visible (per row) |

### Course Detail / Module & Lesson Editor

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View modules & lessons tree | — | — | Visible |
| Create / edit / delete module | — | — | Visible |
| Create / edit / delete lesson | — | — | Visible |

### Lesson Viewer

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View lesson content | Visible | Visible | Visible |
| Mark units as completed | Visible (own) | — | — |
| Mark whole lesson complete | Visible (own) | — | — |

### Progress Overview

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View own progress | Visible | — | — |
| View any user's progress | — | — | Visible |

### Event List

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View upcoming events | Visible | Visible | Visible |
| Create event | — | — | Visible |

### Event Detail

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View event info (venue, date, speakers, status) | Visible | Visible | Visible |
| Register for event | Visible | — | — |
| Edit event | — | — | Visible |
| Publish event (draft → active) | — | — | Visible |
| Manage speakers | — | — | Visible |
| Enter live room | Visible | Visible | Visible |
| View surveys section | Visible | — | Visible |

### Event Create / Edit

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| Set title, date, time, venue, price, currency | — | — | Visible |
| Set event status (draft/active/complete) | — | — | Visible |
| Link course | — | — | Visible |
| All fields editable | — | — | Visible |

### Speaker Profile List & Edit

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View speaker profiles | — | — | Visible |
| Create speaker profile | — | — | Visible |
| Edit own profile | — | Visible | Visible |
| Edit any profile | — | — | Visible |
| Delete profile | — | — | Visible |

### Speaker Assignment

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View assigned speakers | — | — | Visible |
| Add / remove speakers | — | — | Visible |

### Event Registration

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| Register for event | Visible | — | — |
| Proceed to payment | Visible | — | — |

### Checkout

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| Pay via HitPay | Visible | — | — |

### Ticket / QR Wallet

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View own ticket with QR | Visible | — | — |
| View all tickets | — | — | Visible |

### Payment Status

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View own payment status (including amount) | Visible | — | — |
| View all payments (including amounts) | — | — | Visible |

### Live Room

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View current lesson content | Visible | Visible | Visible |
| Post Q&A message | Visible | Visible | Visible |
| View Q&A messages | Visible | Visible | Visible |
| Moderate / delete messages | — | — | Visible |
| Advance to next lesson | — | Visible | Visible |
| Set arbitrary lesson | — | Visible | Visible |

### Support Channel

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View messages | Visible | Visible | Visible |
| Post message | Visible | Visible | Visible |
| Moderate / delete | — | — | Visible |

### Kiosk Scanner

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| QR scan input | — | — | Visible |
| Manual QR entry | — | — | Visible |

### Check-in Confirmation

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| See success / duplicate / reject status | — | — | Visible |

### Check-in List

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View checked-in attendees | — | — | Visible |

### Survey Builder

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| Create survey with title | — | — | Visible |
| Add text / multiple-choice / rating questions | — | — | Visible |
| Set question order | — | — | Visible |
| Edit / delete questions | — | — | Visible |

### Survey Form

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View questions | Visible | — | — |
| Submit responses | Visible (once) | — | — |

### Survey Submitted Confirmation

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| See confirmation message | Visible | — | — |

### Survey Responses

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View all responses per attendee | — | — | Visible |

### Facilitator Dashboard

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| See summary counts | — | — | Visible |
| Access user management | — | — | Visible |
| Access email logs | — | — | Visible |

### User Management

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View all users | — | — | Visible |
| Change user role | — | — | Visible |

### Email Logs

| Action | Attendee | Speaker | Facilitator |
|---|---|---|---|
| View all email logs | — | — | Visible |
| Filter by type / status | — | — | Visible |

---

## Navigation Logic

**Guest (unauthenticated)**
- Landing page → `/events` (public event list with registration CTA)
- Sign In / Sign Up via Clerk buttons in top nav

**Attendee (authenticated, role = attendee)**
- Default landing: `/events`
- Top nav: Events | My Tickets | My Progress
- On event detail: Register → Checkout → Ticket page
- Post-event: Survey link appears in event detail

**Speaker (authenticated, role = speaker)**
- Default landing: `/events` (shows assigned events)
- Top nav: Events (assigned) | My Profile
- Speaker controls visible only for assigned events' live rooms

**Facilitator (authenticated, role = facilitator)**
- Default landing: `/dashboard`
- Side nav: Dashboard | Courses | Events | Speakers | Kiosk | Logs
- Full access to all screens

**Kiosk (facilitator-operated device)**
- Route: `/kiosk` — facilitator-only guard
- Full-screen, single-purpose UI with QR scanner input
- No navigation away from kiosk mode without closing the tab
- Self-contained: no attendee login required for check-in operation

---

## Form Requirements

### Event Create / Edit

| Field | Type | Required | Validation |
|---|---|---|---|
| Title | text | Yes | Max 255 chars |
| Event Date | date | Yes | Must be today or future |
| Start Time | time | Yes | |
| End Time | time | Yes | Must be after start_time |
| Venue Name | text | Yes | Max 255 chars |
| Venue Address | text | No | |
| Latitude | number | No | -90 to 90 |
| Longitude | number | No | -180 to 180 |
| Price | number (decimal) | Yes | Must be ≥ 0; max 10 digits, 2 decimal places |
| Currency | select (ISO 4217) | Yes | Default PHP; allow SGD, USD, etc. |
| Status | select (draft, active, complete) | No | Defaults to draft on create; only active/complete visible to non-facilitators |
| Course | select (from existing) | No | Must reference existing course |

### Course Create / Edit

| Field | Type | Required | Validation |
|---|---|---|---|
| Name | text | Yes | Max 255 chars |
| Description | textarea | No | |

### Module Create / Edit

| Field | Type | Required | Validation |
|---|---|---|---|
| Name | text | Yes | Max 255 chars |
| Sequence Order | number | Yes | Must be ≥ 1 |

### Lesson Create / Edit

| Field | Type | Required | Validation |
|---|---|---|---|
| Description | text | Yes | Max 255 chars |
| Content Type | select (pdf, video, image, link) | Yes | |
| Content URL | url | Yes | Must be valid URL |
| Total Units | number | Yes | Must be ≥ 1 |
| Sequence Order | number | Yes | Must be ≥ 1 |

### Speaker Profile Create / Edit

| Field | Type | Required | Validation |
|---|---|---|---|
| User | select (from users) | Yes | User must not already have a profile |
| Bio | textarea | No | |
| Photo URL | url | No | |
| Designation | text | No | |

### Event Registration

| Field | Type | Required | Validation |
|---|---|---|---|
| User | auto (from session) | Yes | Must not already be registered |
| Agreement | checkbox | Yes | Must agree to terms |

### Checkout

Auto-generated from payment record; no attendee-facing form. Redirect to HitPay.

### Survey Builder — Question

| Field | Type | Required | Validation |
|---|---|---|---|
| Question Text | textarea | Yes | |
| Submitted Type | select (text, multiple_choice, rating) | Yes | |
| Sequence Order | number | Yes | Must be ≥ 1 |
| Options (if multiple_choice) | repeated text inputs | Yes (for multiple_choice) | At least 2 options |

### Survey Response

| Field | Type | Required | Validation |
|---|---|---|---|
| Answer (text type) | textarea | Yes | |
| Answer (multiple_choice) | radio group | Yes | Must select one option |
| Answer (rating) | radio group (1–5) | Yes | Must select 1–5 |

### User Management (facilitator only)

| Field | Type | Required | Validation |
|---|---|---|---|
| User | read-only (list) | — | |
| Role | select (attendee, speaker, facilitator) | Yes | |

---

## Acceptance Checklist

- [x] Every module from Phase 2 has ≥1 screen.
- [x] Every permission-matrix "allow" cell has a corresponding UI affordance.
- [x] Kiosk flow is self-contained (no attendee login dependency).
- [x] Navigation logic defined per role with default landing pages.
