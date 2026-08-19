// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SpeakerEventDetailPage } from "@/modules/events/pages/speaker-event-detail";
import { expectStaffColumn } from "./helpers/staff-column";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ eventId: "9" }),
}));
vi.mock("@/modules/events/lib/use-speaker-event", () => ({ useSpeakerEvent: vi.fn() }));

import { useSpeakerEvent } from "@/modules/events/lib/use-speaker-event";

const event = {
  event_id: 9,
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
  venue_address: "123 Main St",
  cover_image_url: null,
  event_type: "onsite",
  status: "active",
  course_id: 3,
  course_name: "Kickoff",
  description: "The big day.\n\nSecond paragraph.",
  attendee_count: 42,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SpeakerEventDetailPage", () => {
  beforeEach(() => {
    (useSpeakerEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      event,
      loading: false,
      error: null,
    });
  });

  it("shows a loading state before the event arrives", () => {
    (useSpeakerEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      event: null,
      loading: true,
      error: null,
    });

    render(<SpeakerEventDetailPage />);

    expect(screen.getByText("Loading event details...")).toBeTruthy();
  });

  it("shows the failure message instead of the page when the event cannot load", () => {
    (useSpeakerEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      event: null,
      loading: false,
      error: "Not assigned to this event",
    });

    render(<SpeakerEventDetailPage />);

    expect(screen.getByText("Not assigned to this event")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("renders the shared hero, description and attendee count", () => {
    render(<SpeakerEventDetailPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Launch Day" })).toBeTruthy();
    // The hero puts the event facts on the side of the cover panel.
    expect(screen.getByText("Sep 1, 2026")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 5:00 PM")).toBeTruthy();
    expect(screen.getByText("Main Hall, 123 Main St")).toBeTruthy();

    expect(screen.getByText("The big day.")).toBeTruthy();
    expect(screen.getByText("Second paragraph.")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("offers course management when the event has a course", () => {
    render(<SpeakerEventDetailPage />);

    expect(screen.getByRole("link", { name: "Manage Course" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Enter Course Room" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Build Course" })).toBeNull();
  });

  it("offers building the course when the event has none yet", () => {
    (useSpeakerEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      event: { ...event, course_id: null, course_name: null },
      loading: false,
      error: null,
    });

    render(<SpeakerEventDetailPage />);

    expect(screen.getByRole("link", { name: "Build Course" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Enter Course Room" })).toBeNull();
  });

  it("sits in the same column as every other staff page", () => {
    const { container } = render(<SpeakerEventDetailPage />);

    expectStaffColumn(container);
  });
});
