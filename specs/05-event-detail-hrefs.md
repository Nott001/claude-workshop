# 05. Update the speaker event detail page back buttons and course links

## Goal

Fix the two in-page navigation targets on the speaker detail page so a speaker
can get back to their list and into their course builder after the route
rename. The back action (an error-state button and the top breadcrumb) moves
from `/speaker/dashboard` to `/speaker/events`, and its copy changes from
"Back to Dashboard" to "Back to My Events" to match the new nav label.

## Run order

Fifth. Depends on sheet `01` (both target routes now live under `events/`).

## Files touched

- `src/modules/events/pages/speaker-event-detail.tsx`

## Prerequisites

- Sheet `01` complete.

## Steps

1. Error-state back button (line 31) — route and copy:

   ```diff
   -          onClick={() => router.push("/speaker/dashboard")}
   +          onClick={() => router.push("/speaker/events")}
   ...
   -          Back to Dashboard
   +          Back to My Events
   ```

2. Top breadcrumb back button (line 44) — route and copy:

   ```diff
   -          onClick={() => router.push("/speaker/dashboard")}
   +          onClick={() => router.push("/speaker/events")}
   ...
   -          Back to Dashboard
   +          Back to My Events
   ```

3. The two "Manage Course" / "Build Course" links (lines 132 and 140):

   ```diff
   -                    href={`/speaker/event/${eventId}/course`}
   +                    href={`/speaker/events/${eventId}/course`}
   ```

   both occurrences.

4. Leave the "Enter Course Room" link (`/courses/{courseId}/room`) alone — that
   route does not move.

## Verification

- `grep -n "speaker/" src/modules/events/pages/speaker-event-detail.tsx` shows
  only `/speaker/events` and `/speaker/events/${eventId}/course`.
- `grep -c "Back to Dashboard" src/modules/events/pages/speaker-event-detail.tsx`
  is `0`; `grep -c "Back to My Events" …` is `2`.

## Risks / notes

- Both back controls are hard-coded to the speaker list, not derived from
  `roleHome()`, so they cannot drift the way the sign-in flow can — update the
  literal, not the call site.
- Do not rename the `staff-event-detail.tsx` equivalents; that page's back
  target (`/staff/events`, `/staff/events/assigned`) is untouched by this series.
