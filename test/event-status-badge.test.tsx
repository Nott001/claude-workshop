// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("EventStatusBadge", () => {
  it("shows the live pill while the event window covers now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));

    render(<EventStatusBadge status="active" date="2026-06-01" startTime="11:00" endTime="13:00" />);

    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("labels the status instead when the event has not started", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));

    render(<EventStatusBadge status="active" date="2026-06-01" startTime="13:00" endTime="14:00" />);

    expect(screen.getByText("Upcoming")).toBeTruthy();
  });

  it("maps stored statuses through the same labels the listing used", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));

    const { unmount } = render(<EventStatusBadge status="draft" date="2026-06-02" startTime="13:00" endTime="14:00" />);
    expect(screen.getByText("Draft")).toBeTruthy();
    unmount();

    render(<EventStatusBadge status="complete" date="2026-06-02" startTime="13:00" endTime="14:00" />);
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("gives the completed pill a check icon instead of the upcoming sparkle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0));

    const { unmount } = render(<EventStatusBadge status="active" date="2026-06-05" startTime="13:00" endTime="14:00" />);
    expect(screen.getByText("auto_awesome")).toBeTruthy();
    unmount();

    render(<EventStatusBadge status="complete" date="2026-06-02" startTime="13:00" endTime="14:00" />);
    expect(screen.getByText("check_circle")).toBeTruthy();
    expect(screen.queryByText("auto_awesome")).toBeNull();
  });
});
