// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { EventRegisterCard } from "@/modules/events/components/event-register-card";
import type { EventWithCourse } from "@/modules/events/lib/types";

const baseEvent: EventWithCourse = {
  id: 7,
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Hall A",
  venue_address: "123 Main St",
  course_id: null,
  cover_image_url: null,
  status: "active",
  price: 250,
  currency: "PHP",
  description: "Join us",
  survey_enabled: false,
  COURSE: null,
  EVENT_SPEAKER: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("EventRegisterCard", () => {
  it("shows Register for a signed-out visitor and calls onRegister on click", () => {
    const onRegister = vi.fn();
    render(<EventRegisterCard event={baseEvent} hasTicket={false} isSignedIn={false} onRegister={onRegister} />);

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(onRegister).toHaveBeenCalled();
  });

  it("shows Register for a signed-in attendee without a ticket", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Register" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /enter room/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /view ticket/i })).toBeNull();
  });

  it("shows Enter Room and routes to the linked course room once the event has started", () => {
    render(
      <EventRegisterCard
        event={{ ...baseEvent, COURSE: { id: 7, course_name: "Course", course_description: null }, event_date: "2020-01-01" }}
        hasTicket={true}
        isSignedIn={true}
        onRegister={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enter room/i }));
    expect(push).toHaveBeenCalledWith("/courses/7/room");
  });

  it("locks the room button until the event starts, so a ticket holder cannot click in early", () => {
    render(
      <EventRegisterCard
        event={{ ...baseEvent, COURSE: { id: 7, course_name: "Course", course_description: null } }}
        hasTicket={true}
        isSignedIn={true}
        onRegister={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: /locked until start/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /enter room/i })).toBeNull();
  });

  it("shows View Ticket and routes to /tickets once the event has started and no course is linked", () => {
    render(
      <EventRegisterCard
        event={{ ...baseEvent, event_date: "2020-01-01" }}
        hasTicket={true}
        isSignedIn={true}
        onRegister={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /view ticket/i }));
    expect(push).toHaveBeenCalledWith("/tickets");
  });

  it("locks the button before the event starts even when no course is linked, instead of View Ticket", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={true} isSignedIn={true} onRegister={vi.fn()} />);

    const button = screen.getByRole("button", { name: /locked until start/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /view ticket/i })).toBeNull();
  });

  it("hides the price row for a free event and shows it for a paid one", () => {
    render(<EventRegisterCard event={{ ...baseEvent, price: 0 }} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />);
    expect(screen.queryByText(/PHP/)).toBeNull();
    expect(screen.queryByText(/price/i)).toBeNull();
  });

  it("lists the price and leaves the venue to the address card", () => {
    const { container } = render(
      <EventRegisterCard event={baseEvent} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />,
    );

    expect(screen.getByText(/PHP 250\.00/)).toBeTruthy();
    expect(container.querySelectorAll(".text-right").length).toBeGreaterThan(0);
    // The venue is shown once on the page now, on the card that maps it.
    expect(screen.queryByText("Hall A, 123 Main St")).toBeNull();
    expect(screen.queryByText(/venue/i)).toBeNull();
  });

  it("hides the price once the caller already holds a ticket", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={true} isSignedIn={true} onRegister={vi.fn()} />);

    expect(screen.queryByText(/PHP 250\.00/)).toBeNull();
    expect(screen.queryByText(/price/i)).toBeNull();
  });

  it("drops the list entirely rather than leaving an empty one above the button", () => {
    // A ticket holder sees no price, and the venue has moved out, so there is
    // no row left to render — and an empty <ul> would still carry its margin.
    const { container } = render(
      <EventRegisterCard event={baseEvent} hasTicket={true} isSignedIn={true} onRegister={vi.fn()} />,
    );

    expect(container.querySelector("ul")).toBeNull();
  });

  it("places the Add to Calendar control directly below the register button", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />);

    const register = screen.getByRole("button", { name: "Register" });
    const calendar = screen.getByRole("button", { name: /add to calendar/i });
    expect(register.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the Add to Calendar control even when the event already started", () => {
    render(
      <EventRegisterCard
        event={{ ...baseEvent, event_date: "2020-01-01", start_time: "00:00", end_time: "01:00" }}
        hasTicket={false}
        isSignedIn={true}
        onRegister={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeTruthy();
  });
});
