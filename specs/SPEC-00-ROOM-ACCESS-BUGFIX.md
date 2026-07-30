# SPEC-00 — Speaker Room Access Bugfix

Prerequisites: none
After this: SPEC-01-A

## Scope

1 file, 1 line changed. Fixes a pre-existing bug where a speaker who is
assigned to an event but does not hold a ticket is denied entry to the event
room.

## Background

`fetch-event-access.ts` skips the ticket fetch for speakers (line 19:
`role !== "facilitator" && role !== "speaker"`). This means `hasTicket` is
always `false` for speakers. Then `use-room-access.ts` checks:

```ts
const hasTicketOrBypass = hasMinRole(user.role, "facilitator") || accessData.hasTicket;
```

For a speaker: `hasMinRole("speaker", "facilitator")` = false, and
`accessData.hasTicket` = false. So the check fails even for an assigned
speaker, and they get `"no_ticket"` — denied entry to their own room.

The ticket bypass was clearly intended for speakers too, but the check only
includes `facilitator`+. The assignment check on line 87 already ensures the
speaker is assigned to this event before we reach this line, so adding
`accessData.isSpeakerAssigned` to the bypass is safe — it only applies to
speakers who passed the assignment gate.

## Change

### `src/modules/events/lib/use-room-access.ts` — line 88

```ts
// Before:
const hasTicketOrBypass = hasMinRole(user.role, "facilitator") || accessData.hasTicket;
// After:
const hasTicketOrBypass = hasMinRole(user.role, "facilitator") || accessData.hasTicket || accessData.isSpeakerAssigned;
```

## Why before SPEC-01-A

This bug affects the `/speaker/event/[eventId]/room` page. If we don't fix it
before the role restructure, speakers would be unable to enter their own room
even after SPEC-01-E gives them a course page. Fixing it first means the
entire restructure builds on working room access.

## Verification

- Sign in as a `speaker` assigned to an event with no ticket → `/speaker/event/[eventId]/room` → room loads.
- Sign in as a `speaker` NOT assigned to an event → room → "Access denied." (unchanged).
- Sign in as an `attendee` with a valid ticket → room → loads (unchanged).
- Sign in as an `attendee` without a ticket → room → "You need a ticket." (unchanged).
