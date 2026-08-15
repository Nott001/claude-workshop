// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventDetailHero } from "@/modules/events/components/event-detail-hero";

const baseEvent = {
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  cover_image_url: null,
  venue_name: "Hall A",
  venue_address: "123 Main St",
} as const;

const renderHero = (props: Partial<Parameters<typeof EventDetailHero>[0]> = {}) =>
  render(<EventDetailHero event={baseEvent} badgeLabel="Upcoming" {...props} />);

afterEach(cleanup);

describe("EventDetailHero", () => {
  it("renders the cover image with the event title as alt", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });

    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/cover.jpg");
    expect(img.getAttribute("alt")).toBe("Launch Day");
  });

  // The card clips its overflow, so percentage tracks did not visibly hang here
  // — they cost the text panel most of its right padding instead, leaving the
  // title against the card edge. Same root cause as the page grid, hidden.
  it("sizes its columns in fr so the gap cannot eat the text panel's padding", () => {
    const { container } = renderHero();

    const grid = container.querySelector(".grid");
    const tracks = [...(grid?.classList ?? [])].find((c) => c.startsWith("lg:grid-cols-"));

    expect(tracks).toBe("lg:grid-cols-[65fr_35fr]");
    expect(tracks).not.toMatch(/%/);
  });

  it("renders the gradient fallback when there is no cover image", () => {
    const { container } = renderHero();

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".from-sky-500")).not.toBeNull();
  });

  it("shows the badge label, title and the formatted date/time facts", () => {
    renderHero();

    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Launch Day" })).toBeTruthy();
    expect(screen.getByText("Sep 1, 2026")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 5:00 PM")).toBeTruthy();
  });

  it("shows the duration and venue facts derived from the event", () => {
    renderHero();

    expect(screen.getByText("8 hours")).toBeTruthy();
    expect(screen.getByText("Hall A, 123 Main St")).toBeTruthy();
  });

  it("omits the duration when the window is inverted", () => {
    renderHero({ event: { ...baseEvent, start_time: "17:00", end_time: "09:00" } });

    expect(screen.queryByText(/( hours| hr | min\b)/)).toBeNull();
  });

  it("omits the venue fact when the event has no venue", () => {
    renderHero({ event: { ...baseEvent, venue_name: "", venue_address: null } });

    expect(screen.queryByText(/venue/i)).toBeNull();
  });

  it("never mentions seats", () => {
    renderHero();

    expect(screen.queryByText(/seat/i)).toBeNull();
  });

  it("leaves the register CTA to the register card", () => {
    renderHero();

    expect(screen.queryByRole("button", { name: /register/i })).toBeNull();
  });

  it("shows the countdown for an upcoming event", () => {
    renderHero({ event: { ...baseEvent, event_date: "2099-01-01" } });

    expect(screen.getByText("Starts in")).toBeTruthy();
  });

  it("hides the countdown once the event has started", () => {
    renderHero({ event: { ...baseEvent, event_date: "2020-01-01" } });

    expect(screen.queryByText("Starts in")).toBeNull();
  });
});
