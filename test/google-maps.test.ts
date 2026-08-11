import { describe, it, expect } from "vitest";
import { buildGoogleMapsUrl } from "@/shared/lib/google-maps";

describe("buildGoogleMapsUrl", () => {
  it("joins the venue name and address into the search query", () => {
    expect(buildGoogleMapsUrl({ name: "Hall A", address: "123 Main St" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Hall%20A%2C%20123%20Main%20St",
    );
  });

  it("falls back to whichever part of the venue is present", () => {
    expect(buildGoogleMapsUrl({ name: "Hall A" })).toBe("https://www.google.com/maps/search/?api=1&query=Hall%20A");
    expect(buildGoogleMapsUrl({ address: "123 Main St" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St",
    );
  });

  it("returns null for an empty venue so the map card can hide", () => {
    expect(buildGoogleMapsUrl({})).toBeNull();
    expect(buildGoogleMapsUrl({ name: "  ", address: "" })).toBeNull();
    expect(buildGoogleMapsUrl({ name: null, address: null })).toBeNull();
  });
});
