# 04. Update the speaker event list detail links

## Goal

Point every event card on the speaker's "My Events" page at the renamed detail
route, so clicking a card navigates to `/speaker/events/{id}` instead of the
dead `/speaker/event/{id}`.

## Run order

Fourth. Depends on sheet `01` (the route now lives under `events/[eventId]`).

## Files touched

- `src/modules/events/pages/speaker-event-list.tsx`

## Prerequisites

- Sheet `01` complete.

## Steps

1. In `src/modules/events/pages/speaker-event-list.tsx`, change the card's
   detail href (line 51):

   ```diff
   -                detailHref={`/speaker/event/${event.event_id}`}
   +                detailHref={`/speaker/events/${event.event_id}`}
   ```

2. Do not touch the hook `useSpeakerEvents()` (it calls `/api/speakers/me/events`,
   which is unrelated to the page URL).

## Verification

- `grep -n "speaker/" src/modules/events/pages/speaker-event-list.tsx` shows
  only `detailHref={`/speaker/events/${event.event_id}`}`.

## Risks / notes

- The API path `/api/speakers/me/events` embeds the word "events" but is a
  **backend route**, not a page route — leave it alone. Only the page-level
  `detailHref` changes here.
