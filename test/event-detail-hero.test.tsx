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
  status: "active",
} as const;

afterEach(cleanup);

describe("EventDetailHero", () => {
  it("renders the cover image with the event title as alt", () => {
    render(<EventDetailHero event={{ ...baseEvent, cover_image_url: "/cover.jpg" }} badgeLabel="Upcoming" />);

    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/cover.jpg");
    expect(img.getAttribute("alt")).toBe("Launch Day");
  });

  it("renders the gradient fallback when there is no cover image", () => {
    const { container } = render(<EventDetailHero event={baseEvent} badgeLabel="Upcoming" />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".from-sky-500")).not.toBeNull();
  });

  it("shows the badge label, title and the formatted date/time line", () => {
    render(<EventDetailHero event={baseEvent} badgeLabel="Upcoming" />);

    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Launch Day" })).toBeTruthy();
    expect(screen.getByText(/Sep 1, 2026/)).toBeTruthy();
    expect(screen.getByText(/9:00 AM/)).toBeTruthy();
    expect(screen.getByText(/5:00 PM/)).toBeTruthy();
  });

  it("appends the duration derived from start and end times", () => {
    render(<EventDetailHero event={baseEvent} badgeLabel="Upcoming" />);

    expect(screen.getByText(/8 hours/)).toBeTruthy();
  });

  it("omits the duration when the window is inverted", () => {
    render(<EventDetailHero event={{ ...baseEvent, start_time: "17:00", end_time: "09:00" }} badgeLabel="Upcoming" />);

    expect(screen.queryByText(/( hours| hr | min\b)/)).toBeNull();
  });

  it("never mentions speakers or seats", () => {
    render(<EventDetailHero event={baseEvent} badgeLabel="Upcoming" />);

    expect(screen.queryByText(/speaker/i)).toBeNull();
    expect(screen.queryByText(/seat/i)).toBeNull();
  });
});
