import { describe, it, expect } from "vitest";
import { buildGoogleMapsEmbedUrl } from "@/shared/lib/google-maps";

describe("buildGoogleMapsEmbedUrl", () => {
  it("joins the venue name and address into the embedded map's query", () => {
    expect(buildGoogleMapsEmbedUrl({ name: "Hall A", address: "123 Main St" })).toBe(
      "https://www.google.com/maps?q=Hall%20A%2C%20123%20Main%20St&output=embed",
    );
  });

  it("falls back to whichever part of the venue is present", () => {
    expect(buildGoogleMapsEmbedUrl({ name: "Hall A" })).toBe("https://www.google.com/maps?q=Hall%20A&output=embed");
    expect(buildGoogleMapsEmbedUrl({ address: "123 Main St" })).toBe(
      "https://www.google.com/maps?q=123%20Main%20St&output=embed",
    );
  });

  it("escapes a venue that would otherwise rewrite the query string", () => {
    // An ampersand in a venue name would read as the start of another
    // parameter and drop output=embed, which serves a full Maps page instead.
    const url = buildGoogleMapsEmbedUrl({ name: "Smith & Co", address: "1 A St" });

    expect(url).toContain("Smith%20%26%20Co");
    expect(url).toMatch(/&output=embed$/);
  });

  it("returns null for an empty venue so the card can hide", () => {
    expect(buildGoogleMapsEmbedUrl({})).toBeNull();
    expect(buildGoogleMapsEmbedUrl({ name: "  ", address: "" })).toBeNull();
    expect(buildGoogleMapsEmbedUrl({ name: null, address: null })).toBeNull();
  });
});
