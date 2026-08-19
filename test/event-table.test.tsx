// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
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
    capacity: 50,
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

  it("renders the drawer actions as links, not buttons wearing a link", () => {
    render(<EventTable events={rows} showKiosk showEdit />);

    fireEvent.click(screen.getByRole("row", { name: /Open Launch/ }));

    const dialog = screen.getByRole("dialog");
    for (const name of ["Open", "Kiosk", "Edit"]) {
      const action = within(dialog).getByRole("link", { name });
      // role="button" or type="button" here means it went back through the
      // button primitive, which costs the anchor its link semantics.
      expect(action.getAttribute("role")).toBeNull();
      expect(action.getAttribute("type")).toBeNull();
    }
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

  it("renders the attendee count against the cap for a capped event", () => {
    render(<EventTable events={rows} />);

    expect(screen.getByText("12 / 50")).toBeTruthy();
  });

  it("renders the bare count for an uncapped event, with no empty divider", () => {
    render(<EventTable events={rows} />);

    // The second row has no capacity; "0 /" would read as a cap of nothing.
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("renders the empty message when there are no events", () => {
    render(<EventTable events={[]} />);

    expect(screen.getByText("No events found")).toBeTruthy();
  });

  it("keeps the column headers when there are no events", () => {
    render(<EventTable events={[]} />);

    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("No events found")).toBeTruthy();
  });

  it("dims the existing rows, not the header, while a search refetch is in flight", () => {
    render(<EventTable events={rows} loading />);

    expect(screen.getByText("Launch")).toBeTruthy();
    expect(screen.getByText("Date")).toBeTruthy();
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBe("true");
  });

  // A single centred spinner stood about a tenth as tall as the rows it was
  // standing in for, so the table grew some four hundred pixels when its data
  // arrived and pushed the page down with it.
  it("holds the rows' height under the headers, not the empty message, while the first load is pending", () => {
    const { container } = render(<EventTable events={[]} loading />);

    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.queryByText("No events found")).toBeNull();
    expect(screen.queryByText("progress_activity")).toBeNull();
    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(1);
  });
});
