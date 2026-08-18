// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventJoinCard } from "@/modules/events/components/event-join-card";

const LINK = "https://meet.google.com/abc-defg-hij";

const online = {
  event_type: "online",
  event_date: "2026-09-01",
  start_time: "09:00",
  meeting_url: null,
} as const;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("EventJoinCard", () => {
  it("renders nothing for an onsite event, which has a map instead", () => {
    const { container } = render(<EventJoinCard event={{ ...online, event_type: "onsite" }} />);

    expect(container.firstChild).toBeNull();
  });

  it("promises the link rather than showing one before the event starts", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00"));

    render(<EventJoinCard event={online} />);

    expect(screen.getByText(/appears here when the event starts/i)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the link once the API has served one", () => {
    vi.setSystemTime(new Date("2026-09-01T09:30:00"));

    render(<EventJoinCard event={{ ...online, meeting_url: LINK }} />);

    const link = screen.getByRole("link", { name: /join the meeting/i });
    expect(link.getAttribute("href")).toBe(LINK);
  });

  it("opens the meeting without handing the destination a referrer", () => {
    vi.setSystemTime(new Date("2026-09-01T09:30:00"));

    render(<EventJoinCard event={{ ...online, meeting_url: LINK }} />);

    const link = screen.getByRole("link", { name: /join the meeting/i });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("says the link is not posted yet once the event has started without one", () => {
    vi.setSystemTime(new Date("2026-09-01T09:30:00"));

    render(<EventJoinCard event={online} />);

    expect(screen.getByText(/no joining link has been posted/i)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
