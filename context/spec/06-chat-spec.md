# Build Phase 6 — Chat: Support + Live Q&A Channels

## Context

During the live session, attendees need two communication channels: a live Q&A channel for asking the speaker questions (visible to all in the room) and a support channel for logistical issues (visible to facilitators and attendees). Chat messages are per-event, channel-scoped, and persisted. This phase depends on Phase 5 (the live room exists and provides the UI shell) and Phase 3 (the event context).

## Objective

Build the chat subsystem: CHAT_MESSAGES table migration; message CRUD API; real-time message subscription via Supabase Realtime; UI panels embedded in the live room and a standalone support page; facilitator moderation (delete).

## Scope

- Database migration: CHAT_MESSAGES table (message_id, event_id, channel, user_id, message, sent_at, read_by, updated_at per data-model.md)
- API routes:
  - `GET /api/chat/[eventId]?channel=support|live_qa` — paginate messages (cursor-based, limited to 50 per page)
  - `POST /api/chat/[eventId]` — send message (all roles); body: `{ channel, message }`
  - `DELETE /api/chat/[eventId]/[messageId]` — delete message (facilitator only; soft-delete or hard-delete — hide from UI)
- `lib/realtime/` extension:
  - Subscribe to `CHAT_MESSAGES` INSERT events filtered by `event_id` and `channel`
  - New messages appear without polling
  - **Prerequisite:** Supabase Realtime must be enabled on the `CHAT_MESSAGES` table for INSERT subscriptions to fire
- Screens:
  - Live Q&A Panel: embedded in `/events/[id]/live` (replaces placeholder from Phase 5)
    - Chat message list with scroll-to-bottom on new messages
    - Message input box
    - Delete button visible only for facilitator on each message
  - Support Channel: `/events/[id]/support` (standalone page, also available as panel)
    - Same UI as Q&A panel but scoped to `channel = support`
- `modules/chat/` domain logic:
  - Channel restricted to `support` or `live_qa` (enum enforcement)
  - Facilitators may delete any message; others may not
  - Message rate limiting: max 5 messages per 10 seconds per user per channel
- Chat UI behavior:
  - Messages sorted by `sent_at` ascending
  - Auto-scroll to bottom on new message unless user scrolled up (detect scroll position)
  - Show sender name and timestamp per message

## Constraints

- Chat is per-event; a user may only access chat for events they are part of
- No attendee-to-attendee DM; all messages are broadcast within the channel
- Delete removes the message from all clients in real time (no moderation queue for MVP)
- Rate limiting is enforced server-side, not just client-side

## Deliverable

- Attendees can post and see Q&A messages in the live room in real time
- Attendees and facilitators can use the support channel for event logistics
- Facilitator can delete any message in either channel
- Messages persist across page refreshes (paginated history)

## Acceptance Criteria

- [ ] Attendee posts a Q&A message; all other attendees and the speaker see it within 1 second
- [ ] Attendee sends a support message; all facilitators in the support channel see it
- [ ] Facilitator deletes a message; it disappears from all clients immediately
- [ ] Scrolling up in the chat does not auto-scroll on new messages
- [ ] Rate limiter rejects the 6th message within 10 seconds with a 429
- [ ] Refreshing the page loads the last 50 messages with correct history
