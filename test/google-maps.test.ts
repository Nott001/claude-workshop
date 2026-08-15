import { describe, it, expect } from "vitest";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl } from "@/shared/lib/google-maps";

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

describe("buildGoogleMapsEmbedUrl", () => {
  it("asks for an embeddable frame of the same venue the link points at", () => {
    expect(buildGoogleMapsEmbedUrl({ name: "Hall A", address: "123 Main St" })).toBe(
      "https://www.google.com/maps?q=Hall%20A%2C%20123%20Main%20St&output=embed",
    );
  });

  it("escapes a venue that would otherwise rewrite the query string", () => {
    // An ampersand in a venue name would read as the start of another
    // parameter and drop output=embed, which serves a full Maps page instead.
    const url = buildGoogleMapsEmbedUrl({ name: "Smith & Co", address: "1 A St" });

    expect(url).toContain("Smith%20%26%20Co");
    expect(url).toMatch(/&output=embed$/);
  });

  it("returns null for an empty venue so no frame is rendered", () => {
    expect(buildGoogleMapsEmbedUrl({})).toBeNull();
    expect(buildGoogleMapsEmbedUrl({ name: "  ", address: "" })).toBeNull();
  });
});
