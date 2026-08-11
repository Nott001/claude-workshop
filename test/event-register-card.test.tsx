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

  it("shows Enter Room and routes to the linked course room", () => {
    render(
      <EventRegisterCard
        event={{ ...baseEvent, COURSE: { id: 7, course_name: "Course", course_description: null } }}
        hasTicket={true}
        isSignedIn={true}
        onRegister={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enter room/i }));
    expect(push).toHaveBeenCalledWith("/courses/7/room");
  });

  it("shows View Ticket and routes to /tickets when the event has no course", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={true} isSignedIn={true} onRegister={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /view ticket/i }));
    expect(push).toHaveBeenCalledWith("/tickets");
  });

  it("hides the price row for a free event and shows it for a paid one", () => {
    render(<EventRegisterCard event={{ ...baseEvent, price: 0 }} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />);
    expect(screen.queryByText(/PHP/)).toBeNull();
    expect(screen.queryByText(/price/i)).toBeNull();
  });

  it("renders the venue row as the joined name and address", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />);

    expect(screen.getByText("Hall A, 123 Main St")).toBeTruthy();
    expect(screen.getByText(/PHP 250\.00/)).toBeTruthy();
  });

  it("includes the Add to Calendar control", () => {
    render(<EventRegisterCard event={baseEvent} hasTicket={false} isSignedIn={true} onRegister={vi.fn()} />);

    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeTruthy();
  });
});
