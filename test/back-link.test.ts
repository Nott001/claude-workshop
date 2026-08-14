import { describe, it, expect } from "vitest";
import { BACK_LINK_PARAM, resolveBackLink, toBackLinkOrigin, withBackLink } from "@/shared/lib/back-link";

describe("withBackLink", () => {
  it("tags a plain detail path with the origin", () => {
    expect(withBackLink("/events/7", "community")).toBe("/events/7?from=community");
  });

  // Lets a relaying page pass through whatever it was given without branching.
  it("leaves the href untouched when there is no origin to carry", () => {
    expect(withBackLink("/events/7", undefined)).toBe("/events/7");
  });

  it("appends to a path that already carries a query instead of starting a second one", () => {
    expect(withBackLink("/events/7?tab=schedule", "tickets")).toBe("/events/7?tab=schedule&from=tickets");
  });

  it("uses the same parameter name the reader is resolved from", () => {
    const href = withBackLink("/events/7", "home");
    const value = new URLSearchParams(href.split("?")[1]).get(BACK_LINK_PARAM);

    expect(resolveBackLink(value ?? undefined).href).toBe("/home");
  });
});

describe("toBackLinkOrigin", () => {
  it("narrows a known origin and rejects everything else", () => {
    expect(toBackLinkOrigin("community")).toBe("community");
    expect(toBackLinkOrigin(undefined)).toBeUndefined();
    expect(toBackLinkOrigin("/staff/events")).toBeUndefined();
    expect(toBackLinkOrigin("toString")).toBeUndefined();
    expect(toBackLinkOrigin(["community", "tickets"])).toBeUndefined();
  });

  // A relayed origin has to survive one round trip unchanged, or the chain
  // event → register → event loses the reader's place on the way back.
  it("round-trips through withBackLink", () => {
    const relayed = withBackLink("/events/7", toBackLinkOrigin("community"));

    expect(relayed).toBe("/events/7?from=community");
  });
});

describe("resolveBackLink", () => {
  it("resolves each known origin to its route and label", () => {
    expect(resolveBackLink("community")).toEqual({ href: "/community", label: "Back to Community" });
    expect(resolveBackLink("landing")).toEqual({ href: "/", label: "Back to Home" });
    expect(resolveBackLink("tickets")).toEqual({ href: "/tickets", label: "Back to My Tickets" });
  });

  it("falls back to the events list when the parameter is absent", () => {
    expect(resolveBackLink(undefined).href).toBe("/events");
  });

  // The value comes straight off the query string, so it is attacker-controlled.
  it("rejects an unknown or off-site value rather than linking to it", () => {
    expect(resolveBackLink("https://evil.example.com").href).toBe("/events");
    expect(resolveBackLink("//evil.example.com").href).toBe("/events");
    expect(resolveBackLink("/staff/events").href).toBe("/events");
  });

  it("rejects a repeated parameter, which arrives as an array", () => {
    expect(resolveBackLink(["community", "tickets"]).href).toBe("/events");
  });

  it("ignores inherited Object properties that are not origins", () => {
    expect(resolveBackLink("toString").href).toBe("/events");
    expect(resolveBackLink("constructor").href).toBe("/events");
  });
});
