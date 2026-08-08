# SPEC-05 — Unified event room

## Scope

Collapse the three near-identical room pages (attendee 193 lines, staff 220,
speaker 186 — ~85% duplicated) into one `pages/event-room.tsx` driven by a
`variant` prop, and fix the app-shell inconsistency that only hides the navbar on
the attendee room.

## Background

Three hand-copied rooms diverge in five ways: the exit link (public `/events/[id]`
vs staff/speaker dashboard), the highlight toggle (staff + speaker only), reload
after the lock-vote (staff + speaker only), denial messaging, and the role guard.
On top of that, `src/shared/components/app-shell.tsx` hides the navbar only for
`/^\/events\/[^/]+\/room/`, so staff/speaker rooms render inside the chrome while
the attendee room renders bare — an inconsistency, not an intent.

## Changes

- New `src/modules/events/pages/event-room.tsx` exporting
  `export function EventRoom({ variant }: { variant: "attendee" | "staff" | "speaker" })`
  with the common room + per-variant flags:
  - `exitHref` — `/events/[id]` for attendee; `/staff/events/[id]` and
    `/speaker/event/[eventId]` for staff/speaker.
  - `canToggleHighlight` — staff + speaker.
  - `reloadAfterLock` — staff + speaker.
  - `accessDeniedMessage` — per variant.
  - role guard via `event-service` (SPEC-03) — admin+ / assigned facilitator /
    assigned speaker.
  - Common surface (no variant): the session-roadmap sidebar (`SessionTimeline` +
    `ProgressBar`), the per-module `LiveNowTag`, the live-module pill in
    `EventSessionNavbar` (`liveModuleName`/`liveSpeakerName`), and the
    `assignedSpeakerCount` gating of speaker names. The upstream room PR added all
    four identically to every room, so the unified room just absorbs them as common
    code — they are not new variant flags.
- `src/app/events/[id]/room/page.tsx`, `src/app/staff/events/[id]/room/page.tsx`,
  `src/app/speaker/event/[eventId]/room/page.tsx` become thin shells that pass
  their variant.
- Drop the dead `userRole === "speaker"` exit branch in the staff room (unreachable
  once the staff guard applies).
- `src/shared/components/app-shell.tsx` — extend the chrome-hiding pattern to all
  three room paths (e.g. `/^(events|staff\/events)\/[^/]+\/room$/` and
  `/^speaker\/event\/[^/]+\/room$/`) so all three rooms render bare.

## Non-goals

- No change to room behavior or copy other than what the variant flags express.
- No URL changes; kiosk check-in is a separate module.

## Files touched

- `src/modules/events/pages/event-room.tsx` (new)
- 3 room `page.tsx` files under `src/app/{events,staff/events,speaker/event}` (shells)
- `src/shared/components/app-shell.tsx` (room pattern)
- New `test/event-room-variants.test.tsx` asserting the five per-variant flags

## Verification

- `pnpm test` — variant matrix test green.
- `pnpm cf:build` succeeds.
- Manual: all three rooms render navbar-free; exit links and toggles match their
  tree.
