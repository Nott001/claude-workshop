import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isSoldOut, seatsLeft, SOLD_OUT_MESSAGE } from "@/shared/lib/event-capacity";

describe("seatsLeft", () => {
  it("has no answer for an uncapped event", () => {
    expect(seatsLeft(null, 12)).toBeNull();
    expect(seatsLeft(undefined, 12)).toBeNull();
  });

  it("counts down from the cap as tickets are taken", () => {
    expect(seatsLeft(50, 0)).toBe(50);
    expect(seatsLeft(50, 49)).toBe(1);
    expect(seatsLeft(50, 50)).toBe(0);
  });

  it("floors at zero when the cap was lowered under the tickets already sold", () => {
    expect(seatsLeft(10, 25)).toBe(0);
  });
});

describe("isSoldOut", () => {
  it("is never true for an uncapped event, however many attend", () => {
    expect(isSoldOut(null, 10_000)).toBe(false);
  });

  it("turns true on the seat that fills the event, not before", () => {
    expect(isSoldOut(2, 1)).toBe(false);
    expect(isSoldOut(2, 2)).toBe(true);
    expect(isSoldOut(2, 3)).toBe(true);
  });
});

describe("SOLD_OUT_MESSAGE", () => {
  it("is a single phrase every refusal can reuse", () => {
    // The same words the locked button on the event page shows, so a reader who
    // reaches the refusal by a route that skips the button is not told a
    // second, different story about why.
    expect(SOLD_OUT_MESSAGE).toMatch(/sold out/i);
  });
});

/**
 * The route refusal is a courtesy; the trigger is the rule. Two buyers checking
 * out at once both read the same pre-insert count, so without a row lock in the
 * database the event oversells and nothing in the app can notice.
 */
describe("capacity migration (00010)", () => {
  const sql = readFileSync(path.resolve(__dirname, "../supabase/migrations/00010_event_capacity.sql"), "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("adds a nullable capacity column, so existing events stay uncapped", () => {
    expect(sql).toContain('ALTER TABLE "public"."EVENT" ADD COLUMN IF NOT EXISTS "capacity" integer');
    expect(sql).not.toMatch(/"capacity" integer[^;]*NOT NULL/);
    expect(sql).not.toMatch(/"capacity" integer[^;]*DEFAULT/);
  });

  it("refuses a non-positive cap in the database, not only in the form", () => {
    expect(sql).toContain('CHECK (("capacity" IS NULL OR "capacity" > 0))');
  });

  it("locks the event row before counting, so a race cannot oversell", () => {
    const fn = sql.slice(sql.indexOf("enforce_event_capacity"));
    expect(fn).toMatch(/SELECT capacity INTO event_capacity FROM "EVENT" WHERE id = NEW\.event_id FOR UPDATE/);
    expect(fn.indexOf("FOR UPDATE")).toBeLessThan(fn.indexOf("count(*)"));
  });

  it("counts a seat as a ticket that is not cancelled, matching the app", () => {
    expect(sql).toContain("FROM \"TICKET\" WHERE event_id = NEW.event_id AND status <> 'cancelled'");
  });

  it("fires before the ticket insert", () => {
    expect(sql).toContain('BEFORE INSERT ON "public"."TICKET"');
  });

  it("indexes TICKET by event, which every seat count filters on", () => {
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_ticket_event" ON "public"."TICKET" USING "btree" ("event_id")');
  });
});
