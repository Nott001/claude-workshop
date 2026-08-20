// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FeaturedEventCard } from "@/modules/events/components/featured-event-card";
import type { LandingEvent } from "@/shared/types";
import { parseEventDateTime } from "@/shared/lib/date-utils";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const featuredEvent = (overrides: Partial<LandingEvent>): LandingEvent => ({
  event_id: 42,
  title: "Demo Day",
  event_date: "2026-06-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Metro Hall",
  status: "active",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
  ...overrides,
});

describe("FeaturedEventCard", () => {
  it("renders the title and links to the speaker event detail page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(parseEventDateTime("2026-06-01", "08:00:00")!);

    render(<FeaturedEventCard event={featuredEvent({})} />);

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/speaker/events/42");
    expect(screen.getByText("Demo Day")).toBeTruthy();
  });

  it("shows the Live badge and Happening now eyebrow while the window covers now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(parseEventDateTime("2026-06-01", "12:00:00")!);

    render(<FeaturedEventCard event={featuredEvent({ start_time: "11:00", end_time: "13:00" })} />);

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Happening now")).toBeTruthy();
    expect(screen.queryByText("Starts in")).toBeNull();
  });

  it("shows Up next and a countdown for a future event, with no Live badge", () => {
    vi.useFakeTimers();
    vi.setSystemTime(parseEventDateTime("2026-06-01", "08:00:00")!);

    render(<FeaturedEventCard event={featuredEvent({})} />);

    expect(screen.getByText("Up next")).toBeTruthy();
    expect(screen.getByText("Starts in")).toBeTruthy();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("renders the formatted date, time range and venue fact rows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(parseEventDateTime("2026-06-01", "08:00:00")!);

    render(<FeaturedEventCard event={featuredEvent({})} />);

    expect(screen.getByText("Jun 1, 2026")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 5:00 PM")).toBeTruthy();
    expect(screen.getByText("Metro Hall")).toBeTruthy();
  });
});
