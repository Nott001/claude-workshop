# Build Phase 5 — Live Session Room: State Model + Real-Time Broadcast

## Context

During an event, the live session room is the core real-time experience. The speaker advances through lessons, and all attendees see the current lesson content in sync. The room is driven by a singleton LIVE_SESSION_STATE row per event; updates to this row broadcast to all connected clients via Supabase Realtime. This phase depends on Phase 2 (course content with lessons) and Phase 3 (event exists to own the state).

## Objective

Build the live session room: LIVE_SESSION_STATE table migration; state management API; Supabase Realtime subscription setup; speaker controls for advancing lessons; attendee view that reacts to state changes in real time.

## Scope

- Database migration: LIVE_SESSION_STATE table (event_id PK/FK, current_lesson_id FK nullable, updated_by FK, updated_at; per data-model.md)
- API routes:
  - `GET /api/live/[eventId]` — get current session state (all roles in event)
  - `PATCH /api/live/[eventId]` — update current_lesson_id (speaker/facilitator); validates lesson belongs to event's linked course module tree
  - `POST /api/live/[eventId]/state` — initialize or reset session state (facilitator)
- `lib/realtime/` — Supabase Realtime channel setup utility:
  - Subscribe to `LIVE_SESSION_STATE` changes filtered by `event_id`
  - Pass typed payloads to React state
  - **Prerequisite:** Supabase Realtime must be enabled on the `LIVE_SESSION_STATE` table before subscriptions receive change events
- Screens:
  - `/events/[id]/live` — live room page
    - Attendee view: current lesson content viewer (reuses lesson viewer from Phase 2), Q&A panel placeholder (wired in Phase 6), support chat placeholder (wired in Phase 6)
    - Speaker view: same + lesson advance/dropdown controls, current lesson indicator
    - Facilitator view: same + can also advance lessons
- `modules/live-session/` domain logic:
  - Validate `current_lesson_id` belongs to a lesson in the event's linked course module tree
  - Only one state row per event (PK enforces this)
  - `updated_by` must reference a user with role `speaker` or `facilitator`
- Real-time sync:
  - When a speaker PATCHes the state, the change propagates via Supabase Realtime
  - All connected attendee clients update the lesson viewer within ~500ms
  - Fallback: polling every 10s if Realtime connection drops

## Constraints

- No chat functionality in this phase (Phase 6); only lesson broadcast
- State changes must be validated server-side — client-side state is never authoritative
- Supabase Realtime must use filtered subscriptions (channel per event_id) to avoid cross-event leakage
- Lesson content must use the same viewer component from Phase 2

## Deliverable

- Speaker opens the live room, sees a lesson dropdown, selects a lesson, and all attendees see that lesson render
- Speaker advances to the next lesson; attendees see the transition in real time
- Facilitator can override and set any lesson from the course
- No chat messages appear yet; Q&A and support panels are placeholders

## Acceptance Criteria

- [ ] Speaker selects a lesson; attendee browser shows the new lesson content within 1 second
- [ ] Speaker advances through multiple lessons; each transition appears on all attendee screens
- [ ] Facilitator overrides to a non-sequential lesson; all clients sync correctly
- [ ] Opening the live room before the speaker has selected a lesson shows a "Waiting for speaker..." state
- [ ] Disconnecting and reconnecting resumes syncing from the current state
