// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AddToCalendar } from "@/modules/events/components/event-add-to-calendar";

const baseEvent = {
  title: "Launch Day",
  description: "Join us",
  venue_name: "Hall A",
  venue_address: "123 Main St",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
};

const open = vi.fn();

beforeEach(() => {
  window.open = open as typeof window.open;
  open.mockClear();
});

afterEach(cleanup);

describe("AddToCalendar", () => {
  it("opens the dialog with all three options from the trigger", () => {
    render(<AddToCalendar event={baseEvent} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /google calendar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /outlook calendar/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /apple calendar/i })).toBeTruthy();
  });

  it("opens Google Calendar in a new window with the built URL", () => {
    render(<AddToCalendar event={baseEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /google calendar/i }));

    expect(open).toHaveBeenCalledWith(
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Launch%20Day&dates=20260901T090000%2F20260901T170000&details=Join%20us&location=Hall%20A%2C%20123%20Main%20St",
      "_blank",
      "noopener",
    );
  });

  it("opens Outlook Calendar in a new window with the built URL", () => {
    render(<AddToCalendar event={baseEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /outlook calendar/i }));

    expect(open).toHaveBeenCalledWith(
      "https://outlook.live.com/calendar/0/action/compose?allday=false&subject=Launch%20Day&startdt=2026-09-01T09%3A00%3A00&enddt=2026-09-01T17%3A00%3A00&body=Join%20us&location=Hall%20A%2C%20123%20Main%20St",
      "_blank",
      "noopener",
    );
  });

  it("offers the .ics as a data URI download link", () => {
    render(<AddToCalendar event={baseEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));

    const apple = screen.getByRole("link", { name: /apple calendar/i });
    expect(apple.getAttribute("href")).toMatch(/^data:text\/calendar/);
    expect(apple.getAttribute("download")).toBe("");
  });

  it("shows the confirmation row after selecting an option and closes the dialog", () => {
    render(<AddToCalendar event={baseEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /outlook calendar/i }));

    expect(screen.getByText("Added to Outlook Calendar")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("omits location from the built URL when the venue is empty", () => {
    render(<AddToCalendar event={{ ...baseEvent, venue_name: null, venue_address: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /google calendar/i }));

    const url = open.mock.calls[0][0] as string;
    expect(url).not.toContain("location=");
  });
});
