import { describe, it, expect } from "vitest";
import { formatEventPrice, formatVenue, formatDuration } from "@/shared/lib/event-format";

describe("formatEventPrice", () => {
  it("prefixes the event's own currency code", () => {
    expect(formatEventPrice(1500, "USD")).toBe("USD 1,500.00");
  });

  it("returns null for a free event so callers can say so in their own words", () => {
    expect(formatEventPrice(0, "PHP")).toBeNull();
  });

  it("treats a missing price as free rather than printing NaN", () => {
    expect(formatEventPrice(null, "PHP")).toBeNull();
    expect(formatEventPrice(undefined, "PHP")).toBeNull();
  });

  it("falls back to the column's own default when currency is absent", () => {
    expect(formatEventPrice(500, null)).toBe("PHP 500.00");
  });
});

describe("formatVenue", () => {
  it("joins the name and address the event detail page used to omit", () => {
    expect(formatVenue("Hall A", "123 Main St")).toBe("Hall A, 123 Main St");
  });

  it("leaves no dangling comma when the nullable address is unset", () => {
    expect(formatVenue("Hall A", null)).toBe("Hall A");
    expect(formatVenue("Hall A", "   ")).toBe("Hall A");
  });

  it("still renders an address when the name is somehow missing", () => {
    expect(formatVenue("", "123 Main St")).toBe("123 Main St");
  });
});

describe("formatDuration", () => {
  it("formats exact hours with the right pluralization", () => {
    expect(formatDuration("09:00", "16:00")).toBe("7 hours");
    expect(formatDuration("09:00", "10:00")).toBe("1 hour");
  });

  it("mixes hours and minutes", () => {
    expect(formatDuration("09:00", "16:30")).toBe("7 hr 30 min");
  });

  it("formats sub-hour windows in minutes", () => {
    expect(formatDuration("09:00", "09:45")).toBe("45 min");
    expect(formatDuration("09:00", "09:05")).toBe("5 min");
  });

  it("accepts an optional seconds field", () => {
    expect(formatDuration("09:00:30", "16:00:30")).toBe("7 hours");
    expect(formatDuration("09:00:45", "09:15:00")).toBe("14 min");
  });

  it("returns null when an edge is missing or unparseable", () => {
    expect(formatDuration(null, "16:00")).toBeNull();
    expect(formatDuration("09:00", undefined)).toBeNull();
    expect(formatDuration("not-a-time", "16:00")).toBeNull();
  });

  it("returns null for inverted or zero-length windows", () => {
    expect(formatDuration("17:00", "09:00")).toBeNull();
    expect(formatDuration("09:00", "09:00")).toBeNull();
  });
});
