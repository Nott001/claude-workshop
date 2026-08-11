// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

  it("always offers Open, and adds Kiosk only when asked", () => {
    render(<EventTable events={rows} showKiosk />);

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/staff/events/7");
    expect(hrefs).toContain("/staff/events/7/kiosk");
  });

  it("shows the Edit action pointing at the event detail page for admins", () => {
    render(<EventTable events={rows} showEdit />);

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/staff/events/7");
    expect(hrefs.some((href) => href?.includes("?tab="))).toBe(false);
  });

  it("renders the attendee count per row", () => {
    render(<EventTable events={rows} />);

    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders the empty message when there are no events", () => {
    render(<EventTable events={[]} />);

    expect(screen.getByText("No events found.")).toBeTruthy();
  });
});
