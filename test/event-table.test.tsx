// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EventTable, type EventTableRow } from "@/modules/events/components/event-table";

const rows: EventTableRow[] = [
  {
    id: 7,
    title: "Launch",
    event_date: "2026-09-01",
    start_time: "09:00",
    end_time: "17:00",
    venue_name: "Main Hall",
    status: "active",
    attendee_count: 12,
  },
  {
    id: 8,
    title: "Retro",
    event_date: "2026-08-01",
    start_time: "10:00",
    end_time: "18:00",
    venue_name: "Room B",
    status: "draft",
    attendee_count: 0,
  },
];

afterEach(() => {
  cleanup();
});

describe("EventTable", () => {
  it("renders title, date, venue and status for each row", () => {
    render(<EventTable events={rows} />);

    expect(screen.getByText("Launch")).toBeTruthy();
    expect(screen.getByText("Retro")).toBeTruthy();
    expect(screen.getByText("Main Hall")).toBeTruthy();
    expect(screen.getByText("Sep 1, 2026")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
  });

  it("links each title to the event's detail page", () => {
    render(<EventTable events={rows} />);

    const titleLink = screen.getByRole("link", { name: "Launch" });
    expect(titleLink.getAttribute("href")).toBe("/staff/events/7");
  });

  it("opens the drawer on row click and shows the requested actions", () => {
    render(<EventTable events={rows} showKiosk showEdit />);

    fireEvent.click(screen.getByRole("row", { name: /Open Launch/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    const drawerLinks = Array.from(dialog.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(drawerLinks).toContain("/staff/events/7");
    expect(drawerLinks).toContain("/staff/events/7/kiosk");
  });

  it("keeps Kiosk and Edit out of the drawer unless asked", () => {
    render(<EventTable events={rows} />);

    fireEvent.click(screen.getByRole("row", { name: /Open Launch/ }));

    const dialog = screen.getByRole("dialog");
    const drawerLinks = Array.from(dialog.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(drawerLinks).toContain("/staff/events/7");
    expect(drawerLinks).not.toContain("/staff/events/7/kiosk");
  });

  it("lets the title link navigate without opening the drawer", () => {
    render(<EventTable events={rows} />);

    fireEvent.click(screen.getByRole("link", { name: "Launch" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the attendee count per row", () => {
    render(<EventTable events={rows} />);

    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders the empty message when there are no events", () => {
    render(<EventTable events={[]} />);

    expect(screen.getByText("No events found")).toBeTruthy();
  });
});
