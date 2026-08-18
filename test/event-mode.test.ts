import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eventSchema, eventPartialSchema } from "@/modules/events/lib/schemas";
import { toEventPayload, toFormValues, EMPTY_EVENT_FORM } from "@/modules/events/lib/event-form-schema";

const onsite = {
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
};

describe("eventSchema event_type", () => {
  it("defaults to nothing and lets the service apply onsite", () => {
    expect(eventSchema.safeParse(onsite).success).toBe(true);
  });

  it("accepts both modes and refuses anything else", () => {
    expect(eventSchema.safeParse({ ...onsite, event_type: "onsite" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...onsite, event_type: "online" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...onsite, event_type: "hybrid" }).success).toBe(false);
  });

  it("refuses an online event that carries a venue address", () => {
    // Same rule as chk_event_online_has_no_address, checked here so the caller
    // gets a 400 they can read rather than a constraint violation as a 500.
    const parsed = eventSchema.safeParse({ ...onsite, event_type: "online", venue_address: "123 Rizal St" });

    expect(parsed.success).toBe(false);
  });

  it("still accepts an onsite event with an address", () => {
    expect(eventSchema.safeParse({ ...onsite, event_type: "onsite", venue_address: "123 Rizal St" }).success).toBe(true);
  });

  it("applies the same rule to a patch carrying both halves", () => {
    expect(eventPartialSchema.safeParse({ event_type: "online", venue_address: "123 Rizal St" }).success).toBe(false);
    expect(eventPartialSchema.safeParse({ event_type: "online", venue_address: null }).success).toBe(true);
    expect(eventPartialSchema.safeParse({ event_type: "onsite", venue_address: "123 Rizal St" }).success).toBe(true);
  });
});

describe("event mode in the form", () => {
  it("defaults a new event to onsite", () => {
    expect(EMPTY_EVENT_FORM.event_type).toBe("onsite");
  });

  it("seeds the mode from a stored event", () => {
    expect(toFormValues({ event_type: "online" }).event_type).toBe("online");
    expect(toFormValues({ event_type: "onsite" }).event_type).toBe("onsite");
  });

  it("reads a row with no mode at all as onsite", () => {
    // Rows written before the column existed, and any value the enum cannot
    // hold, land on the same default the database gives them.
    expect(toFormValues({}).event_type).toBe("onsite");
    expect(toFormValues({ event_type: "nonsense" }).event_type).toBe("onsite");
  });

  it("drops the address an online event still has in its disabled box", () => {
    // The input is disabled rather than emptied, so the old value survives the
    // switch. Sending it would put a street address on the ticket and in the
    // calendar invite of an event nobody attends in person.
    const payload = toEventPayload({
      ...EMPTY_EVENT_FORM,
      ...onsite,
      event_type: "online",
      venue_name: "Zoom",
      venue_address: "123 Rizal St",
    });

    expect(payload.venue_address).toBeNull();
    expect(payload.event_type).toBe("online");
    expect(eventSchema.safeParse(payload).success).toBe(true);
  });

  it("keeps the address of an onsite event", () => {
    const payload = toEventPayload({
      ...EMPTY_EVENT_FORM,
      ...onsite,
      event_type: "onsite",
      venue_address: "123 Rizal St",
    });

    expect(payload.venue_address).toBe("123 Rizal St");
  });
});

/**
 * The form clears the address and the API refuses the pair, but neither is
 * where the rule can be made true — a direct write reaches neither.
 */
describe("event mode migration (00011)", () => {
  const sql = readFileSync(path.resolve(__dirname, "../supabase/migrations/00011_event_mode.sql"), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("adds the enum with exactly the two modes", () => {
    expect(sql).toMatch(/CREATE TYPE "public"\."event_mode" AS ENUM \(\s*'onsite',\s*'online'\s*\);/);
  });

  it("defaults every existing event to onsite and never allows null", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "event_type" "public"."event_mode"');
    expect(sql).toContain('DEFAULT \'onsite\'::"public"."event_mode" NOT NULL');
  });

  it("refuses an online event with an address in the database", () => {
    expect(sql).toContain('CHECK ((("event_type" <> \'online\'::"public"."event_mode") OR ("venue_address" IS NULL)))');
  });

  it("leaves venue_name NOT NULL, since it now names the platform too", () => {
    // The alternative was making it nullable for online events, which would
    // have weakened a constraint a dozen readers rely on.
    expect(sql).not.toMatch(/ALTER COLUMN "venue_name"/);
    expect(sql).not.toMatch(/DROP NOT NULL/);
  });
});
