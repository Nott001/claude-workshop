# Build Phase 3 — Event CRUD + Speaker Assignment

## Context

Events are the central entity of the platform — they bundle a date/venue, an optional linked course, and assigned speakers. Without events, there is nothing to register for, no live room, and no check-in. This phase depends on Phase 2 (course content must exist before an event can link to it) and Phase 1 (auth for role gating).

## Objective

Build event management and speaker assignment: database migrations for EVENTS, SPEAKER_PROFILES, and EVENT_SPEAKERS; CRUD API routes; facilitator UI for event creation and speaker management; public event listing and detail pages.

## Scope

- Database migrations: EVENTS, SPEAKER_PROFILES, EVENT_SPEAKERS tables (all fields, constraints, unique indexes per data-model.md)
- API routes:
  - `GET /api/events` — list events (all roles, filterable by upcoming/past); draft events hidden from non-facilitators
  - `POST /api/events` — create event (facilitator); defaults to `draft` status
  - `GET /api/events/[id]` — event detail; 404 on draft for non-facilitators
  - `PATCH /api/events/[id]` — update event (facilitator); includes status field
  - `DELETE /api/events/[id]` — delete event (facilitator)
  - `POST /api/events/[id]/publish` — publish draft event (facilitator); transitions `draft` → `active`
  - `GET /api/speakers` — list speaker profiles (facilitator)
  - `POST /api/speakers` — create speaker profile (facilitator)
  - `PATCH /api/speakers/[id]` — update profile (facilitator or own speaker)
  - `DELETE /api/speakers/[id]` — delete profile (facilitator)
  - `GET /api/events/[id]/speakers` — list assigned speakers
  - `POST /api/events/[id]/speakers` — assign speaker (facilitator)
  - `DELETE /api/events/[id]/speakers/[profileId]` — remove speaker assignment (facilitator)
- Screens:
  - `/events` — public event list (all roles)
  - `/events/[id]` — event detail with venue, date, speakers, course info
  - `/events/new` — event create form (facilitator)
  - `/events/[id]/edit` — event edit form (facilitator)
  - `/speakers` — speaker profile list (facilitator)
  - `/speakers/[id]/edit` — edit speaker profile (facilitator or own speaker)
  - `/events/[id]/speakers` — speaker assignment UI (facilitator)
- `modules/event-management/` domain logic (event validation, speaker assignment rules)
- Validation: `start_time < end_time` enforced; event date required; course link optional but must reference an existing course
- Event lifecycle: `draft` (default on create) → `active` (published, visible to all) → `complete` (event concluded)
- Event status can be set via the edit form or via the dedicated publish endpoint for `draft` → `active`

## Constraints

- A course may be linked to at most one event (EVENTS.course_id is UK)
- Speaker profiles are 1:1 with users (one profile per user)
- Facilitator dashboard placeholder already exists; this phase does not build full dashboard
- Event delete must check for existing payments/tickets before allowing deletion (or soft-delete)

## Deliverable

- Facilitator can create, edit, list, and delete events via the UI
- Facilitator can create speaker profiles and assign speakers to events
- Attendees and speakers can browse the public event list and view event details
- Speaker profile editing is self-service for the speaker (own profile only)

## Acceptance Criteria

- [ ] Facilitator creates an event with all required fields; it appears in `/events` (as draft, visible only to facilitator)
- [ ] Draft events are hidden from attendees and speakers in both list and detail views
- [ ] Facilitator publishes a draft event; it becomes visible to all users
- [ ] Facilitator can set event status to `complete` via the edit form
- [ ] Facilitator links an existing course to an event; the course is no longer available for other events
- [ ] Facilitator assigns a speaker to an event; the speaker appears on the event detail page
- [ ] Speaker can log in, navigate to their profile, and edit their bio/photo
- [ ] Event detail page shows date, time, venue, linked course, and assigned speakers
- [ ] Editing an event reflects the changes immediately on the detail page
