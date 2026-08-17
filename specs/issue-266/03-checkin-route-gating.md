# 03 — Restrict kiosk check-in to the event's assigned staff

## Goal

Make `/api/checkin` (POST) and `/api/checkin/lookup` (GET) admit **admins/super_admins by role** and **facilitators assigned to the ticket's event** — everyone else (including an unassigned facilitator, speaker, or attendee) gets `403`. Today these routes only check `requireMinRole(FACILITATOR)`, so any facilitator can check people into any event.

## Why

Issue #266 and consistency with sheet 01. The realtime policy lets a facilitator read tickets only for events they are assigned to; the mutating routes must not be wider than that, or an unassigned facilitator could write a check-in while their own attendee table never updates live. The kiosk page is _view-only_ role-gated (`useRoleGuard(FACILITATOR)`) and stays that way — the mutating and lookup routes are the enforcement point.

## Prerequisites

- Sheets 01–02 applied.

## Changes

### `src/app/api/checkin/route.ts` and `src/app/api/checkin/lookup/route.ts`

After `findByQrToken` succeeds (so we know `ticket.event_id`) and after the existing `404` for an unknown token, enforce the `attendees` capability from the authoritative matrix (`src/modules/events/lib/event-authz.ts` — `CAPABILITY_RULE.attendees` is `{ minRole: FACILITATOR, assignment: true }`):

```ts
import { loadEventOr403 } from "@/modules/events/lib/event-service";
// …

const ticket = await ticketDao.findByQrToken(supabase, parsed.data.qr_token);
if (!ticket) {
  return NextResponse.json({ error: "Invalid QR token" }, { status: 404 });
}

// Role-only gating let any facilitator check any event in. The realtime read
// (sheet 01) is scoped to the event's team, and the mutating routes must not
// be wider: enforce the same `attendees` capability here.
try {
  await loadEventOr403(supabase, ticket.event_id, guard.user, "attendees");
} catch (err) {
  if ((err as { status?: number })?.status === 403) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  throw err;
}
```

`loadEventOr403` keeps the check in one place: admins/super_admins pass by `hasMinRole`, facilitators must be assigned, everyone else is below `FACILITATOR` and rejected. The duck-typed `status` check keeps the routes decoupled from the `EventServiceError` class so tests can reject with a plain `{ status: 403 }`.

Place the check immediately after the unknown-token `404`, **before** the duplicate/cancelled branches, so an unpermitted caller learns nothing about a ticket's state.

## Tests

Extend `test/api-checkin.test.ts` and `test/api-checkin-lookup.test.ts`:

- Mock the new dependency: `vi.mock("@/modules/events/lib/event-service", () => ({ loadEventOr403 }))` (hoisted fn), defaulting to resolve in `beforeEach`.
- Existing tests keep passing once the default `loadEventOr403` resolves.
- New cases, for both routes:
  - an **assigned** facilitator proceeds (assert `loadEventOr403` called with `(client, 10, { id: 7, role: ROLES.FACILITATOR }, "attendees")`);
  - an **unassigned** facilitator is rejected with `403`, `loadEventOr403` rejects `{ status: 403 }`, and — for the POST route — `updateStatus` is **not** called;
  - a ticket that matches **no** event resolves through the existing `404` path unchanged.

For the unassigned case in `api-checkin.test.ts`, also assert `sendEmailNotification` was never called.

## Verification gates (run before committing this sheet)

```
pnpm test -- test/api-checkin.test.ts test/api-checkin-lookup.test.ts
pnpm typecheck
pnpm lint
pnpm format
```

Commit as `fix: restrict kiosk check-in to the event's assigned staff`. Body: role-only gating let any facilitator check in any event, while the realtime read was already scoped to the event team — the mutating routes must not be wider than the delivery path.
