// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FeaturedSessionCard } from "@/modules/events/components/featured-session-card";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const base = {
  event_id: 1,
  title: "Product Summit 2026",
  venue_name: "Hall A",
  status: "active",
  course_name: null,
  cover_image_url: null,
};

describe("FeaturedSessionCard", () => {
  it("shows the event title and its status label", () => {
    render(<FeaturedSessionCard event={{ ...base, event_date: "2026-08-20", start_time: "09:00", end_time: "17:00" }} />);

    expect(screen.getByText("Product Summit 2026")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });

  it("labels a live event as Live, matching the grid badge", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15, 12, 0, 0));

    render(<FeaturedSessionCard event={{ ...base, event_date: "2026-08-15", start_time: "09:00", end_time: "17:00" }} />);

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.queryByText("Upcoming")).toBeNull();
  });

  it("shows neutral placeholder copy when the calendar is empty", () => {
    render(<FeaturedSessionCard event={null} />);

    expect(screen.getByText("No upcoming events")).toBeTruthy();
    expect(screen.getByText("Check back soon")).toBeTruthy();
  });
});
