import { describe, it, expect } from "vitest";
import { formatEventPrice, formatVenue } from "@/shared/lib/event-format";

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
