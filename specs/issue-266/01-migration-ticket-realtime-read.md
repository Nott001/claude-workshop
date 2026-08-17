# 01 — Grant staff and ticket holders a scoped read of TICKET for realtime

## Goal

Give the browser's `authenticated` role a SELECT grant on `TICKET` scoped by a `SECURITY DEFINER` policy helper, so Supabase Realtime delivers `TICKET` changes to the kiosk attendee table (sheet 02) and the attendee's ticket pass (sheet 06). **anon stays fully locked out.**

## Why

Issue #266 (bug 1): the kiosk already subscribes to `TICKET` `UPDATE` events (`subscribeToCheckins`, `src/shared/integrations/realtime/index.ts`) but the table only refreshes on a manual page reload. Migration `00001` grants `TICKET` only to `service_role`; there is **no SELECT grant and no SELECT policy** for the `authenticated` role that the browser client carries. Supabase Realtime runs the row's read policy for every emitted event, finds none, and drops the event — the exact failure `00004_qa_message_policy_helper.sql` already documented for QA messages ("one 42501 killed delivery for every subscriber … until a refresh").

This migration is the foundation both consumers share:

- staff (kiosk) need rows for events they run — admins/super_admins by role, facilitators by `EVENT_FACILITATOR` assignment;
- the ticket pass needs the holder to read their **own** row live.

## Prerequisites

- Branch off `development`: `git switch -c feat/ticket-pass`.
- Do not run `pnpm db:reset` yet — the first replay happens in sheet 02 (it must not carry sheets 03–06 anyway).
- Run sheets in order; the migration in this sheet is a prerequisite for sheets 02 and 06.

## Changes

### `supabase/migrations/00008_ticket_realtime_read.sql` (new file)

Do **not** edit `00001_initial_schema.sql` (AGENTS.md: never edit an existing migration). Follow the seam `00004` established: the policy body calls a `SECURITY DEFINER` helper so the check can read `USER` and `EVENT_FACILITATOR` as the owner **without widening any grant on those tables**. Every statement is idempotent or replay-guarded.

```sql
-- Issue #266: the kiosk attendee table and the ticket pass subscribe to
-- TICKET via Supabase Realtime, which runs the caller's SELECT policy for
-- every emitted row. The browser role is `authenticated`, and 00001 granted
-- TICKET only to service_role -- so no policy matched, realtime dropped every
-- event, and both surfaces only updated on a manual refresh. This grants the
-- role a read scoped by ticket_visible(): admins/super_admins by role,
-- facilitators assigned to the ticket's event, or the ticket's own holder.
-- anon is not granted anything here and stays unable to read TICKET.

GRANT SELECT ON TABLE "public"."TICKET" TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."ticket_visible"(ticket_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM "TICKET" t
    JOIN "USER" me ON me.auth_user_id = auth.uid()
    WHERE t.id = ticket_visible.ticket_id
      AND (
        me.role IN ('admin', 'super_admin')
        OR EXISTS (
          SELECT 1 FROM "EVENT_FACILITATOR" ef
          WHERE ef.event_id = t.event_id AND ef.user_id = me.id
        )
        OR t.user_id = me.id
      )
  );
$function$;

ALTER FUNCTION "public"."ticket_visible"(integer) OWNER TO "postgres";

-- CREATE POLICY has no IF NOT EXISTS, so the pg_policies guard keeps this
-- replay-safe (same pattern as 00003).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_catalog"."pg_policies"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'TICKET'
      AND "policyname" = 'Staff and ticket holders read tickets'
  ) THEN
    EXECUTE $ticket_policy$
      CREATE POLICY "Staff and ticket holders read tickets" ON "public"."TICKET"
        FOR SELECT TO "authenticated"
        USING ("public"."ticket_visible"("id"));
    $ticket_policy$;
  END IF;
END;
$$;
```

Notes on the shape:

- The policy body only calls `ticket_visible("id")` — it introduces no `alias.column = bare_word` comparisons, so `test/rls-policy-correlation.test.ts` (which scans every live policy body) stays green untouched.
- The helper is `SECURITY DEFINER` owned by `postgres`, exactly like `qa_message_visible` (00004/00005). The reference to the parameter uses the function-qualified `ticket_visible.ticket_id` form, not a bare `ticket_id` that a real column would shadow.
- `GRANT SELECT … TO "authenticated"` is the widening that makes realtime delivery possible; `ticket_visible` is what keeps it narrow. **There is no grant to `anon`.**

## Tests

`test/migration-replay.test.ts` — append `"00008_ticket_realtime_read.sql"` to the exact migration list, then add a describe block pinning the final state:

```ts
describe("ticket realtime read final state (00008)", () => {
  const migration = content("00008_ticket_realtime_read.sql");

  it("grants SELECT on TICKET to authenticated, never to anon", () => {
    expect(migration).toContain('GRANT SELECT ON TABLE "public"."TICKET" TO "authenticated";');
    expect(migration).not.toMatch(/TO "anon"/);
  });

  it("routes the read through a SECURITY DEFINER helper", () => {
    expect(migration).toMatch(/ticket_visible/);
    expect(migration).toMatch(/SECURITY DEFINER/s);
    expect(migration).toMatch(/CREATE POLICY "Staff and ticket holders read tickets"/);
    expect(migration).toMatch(/USING \("public"\."ticket_visible"\("id"\)\)/);
  });
});
```

`test/migration-grants.test.ts` — append `"00008_ticket_realtime_read.sql"` to the exact migration list and **rewrite** the guard that pinned TICKET unreadable (that pin is deliberately flipped by this issue):

```ts
// The QA policy never widened TICKET (00004 routed its read through a helper).
// The kiosk and the ticket pass are the opposite: they need the browser role
// to read the rows realtime will deliver, so authenticated gets a scoped
// grant. The pin becomes: anon stays locked out, and the grant is scoped by
// the ticket_visible helper rather than blanket.
it("keeps TICKET unreadable by anon but grants authenticated a scoped read", () => {
  const anon = new RegExp(`GRANT[^;]+ON\\s+\\"?public\\"?\\.\\"TICKET\\"[^;]*TO[^;]*anon`, "i");
  expect(anon.test(all)).toBe(false);
  expect(all).toContain('GRANT SELECT ON TABLE "public"."TICKET" TO "authenticated";');
  expect(all).toContain("ticket_visible");
});
```

## Verification gates (run before committing this sheet)

```
pnpm test -- test/migration-replay.test.ts test/migration-grants.test.ts test/rls-policy-correlation.test.ts
pnpm typecheck
pnpm lint
pnpm format
git diff --stat   # should touch exactly: specs/issue-266/01-..., 00008_ticket_realtime_read.sql, migration-replay.test.ts, migration-grants.test.ts
```

> Do not run `pnpm db:reset` yet — the first replay happens in sheet 02.

Commit as `feat: grant staff and ticket holders a scoped TICKET read for realtime`. Body: realtime runs the caller's SELECT policy per event, and `authenticated` had none, so the kiosk table and the ticket pass could never update live.
