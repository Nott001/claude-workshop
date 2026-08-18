# 05 — Single-ticket detail endpoint

## Goal

Add a way to fetch **one ticket by its `TICKET.id`** (with its event embed) for the boarding-pass page (sheet 06), gated so only the ticket's owner or staff can read it. This is the data half of the pass page; the page half is sheet 06.

## Why

The pass page needs a deep-linkable fetch: `GET /api/tickets/[paymentId]` already exists but is keyed on `payment_id` (nullable — `ON DELETE SET NULL`) and produces a server-side QR the new page does not need. The list (`/api/tickets`) returns paginated rows the card already holds, but a deep link / hard refresh has to resolve a ticket from its id alone. Keying by `TICKET.id` is also the same key the realtime subscription (sheet 06) filters on.

## Prerequisites

- Sheets 01–04 applied.

## Changes

### `src/shared/db/dao/ticket.dao.ts`

Add a sibling of `findWithEvent` (same select shape, different key):

```ts
export async function findByIdWithEvent(supabase: DbClient, ticketId: number): Promise<TicketWithEvent | null> {
  const { data, error } = await supabase.from("TICKET").select(TICKET_CARD_SELECT).eq("id", ticketId).maybeSingle();
  throwOnDbError(error, "ticket.dao.findByIdWithEvent");
  return data;
}
```

### `src/app/api/tickets/detail/[ticketId]/route.ts` (new file)

Next.js matches `[param]` folders by name, so a sibling `[ticketId]` under `api/tickets` would collide with the existing `[paymentId]`; the static `detail/` segment disambiguates. Mirror the ownership gate from `/api/tickets/[paymentId]` (owner, or any facilitator-or-above) — staff listing is already role-wide in `/api/tickets`, so keep that consistent:

```ts
import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { ticketId } = await params;
  const supabase = getServiceClient();
  const ticket = await ticketDao.findByIdWithEvent(supabase, Number(ticketId));

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // A ticket page is a check-in credential; non-staff are held to their own.
  if (!hasMinRole(guard.user.role, ROLES.FACILITATOR) && ticket.user_id !== guard.user.id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
```

## Tests

### New `test/ticket-dao.test.ts`

Mirror the existing DAO test style (mocked client, e.g. `test/community-dao.test.ts`):

- `findByIdWithEvent` selects `TICKET_CARD_SELECT`, filters `eq("id", ticketId)`, uses `maybeSingle`, and returns the row;
- returns `null` on no match;
- surfaces a DB error via `throwOnDbError` (mocked client returns an error object).

### New `test/api-ticket-detail.test.ts`

Mock `@/modules/auth/lib/role-guard`, `@/shared/db/client`, and `@/shared/db/dao/ticket.dao` (hoisted doubles, same pattern as `test/api-checkin.test.ts`). Cases:

- the ticket's owner reads it (`200`, body matches the DAO row);
- a different attendee gets `404` (not `403`) and the row is not leaked;
- a facilitator reads any ticket (`200`);
- an unknown id returns `404`;
- a caller below facilitator who is not the owner returns `404`;
- `guardFailure` path for an unauthenticated/unauthorized caller.

## Verification gates (run before committing this sheet)

```
pnpm test -- test/ticket-dao.test.ts test/api-ticket-detail.test.ts
pnpm typecheck
pnpm lint
pnpm format
git diff --stat   # touches: ticket.dao.ts, api/tickets/detail/[ticketId]/route.ts, two test files, this sheet
```

Commit as `feat: add a single-ticket detail endpoint`. Body: the pass page deep-links by TICKET.id, which is nullable-payment-safe and is the same key realtime filters on.
