// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionTimeline } from "@/modules/events/components/session-timeline";
import type { LiveModuleSource } from "@/modules/events/lib/live-module";

const EVENT_DATE = "2026-09-01";
const NOW = new Date("2026-09-01T10:30:00");

function module(id: number, name: string, start: string | null, end: string | null, speaker?: string): LiveModuleSource {
  return {
    id,
    module_name: name,
    start_time: start,
    end_time: end,
    SPEAKER_PROFILE: speaker ? { id: id + 100, USER: { full_name: speaker } } : null,
  };
}

afterEach(() => {
  cleanup();
});

describe("SessionTimeline", () => {
  it("renders nothing when no module is scheduled", () => {
    const { container } = render(
      <SessionTimeline modules={[module(1, "Open", null, null)]} eventDate={EVENT_DATE} assignedSpeakerCount={1} now={NOW} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists scheduled modules in the order they run with their time slots", () => {
    render(
      <SessionTimeline
        modules={[module(1, "Q&A", "12:00:00", "13:00:00"), module(2, "Keynote", "09:00:00", "10:00:00")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        now={NOW}
      />,
    );

    expect(screen.getByText("Agenda")).toBeTruthy();
    const names = screen.getAllByText(/Keynote|Q&A/);
    expect(names[0].textContent).toContain("Keynote");
    expect(names[1].textContent).toContain("Q&A");
    expect(screen.getByText("9:00 AM – 10:00 AM")).toBeTruthy();
    expect(screen.getByText("12:00 PM – 1:00 PM")).toBeTruthy();
  });

  it("marks the module whose session is running as live", () => {
    render(
      <SessionTimeline
        modules={[
          module(1, "Keynote", "09:00:00", "10:00:00"),
          module(2, "Workshop", "10:00:00", "12:00:00"),
          module(3, "Wrap", "12:00:00", "13:00:00"),
        ]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        now={NOW}
      />,
    );

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Keynote").closest("li")!.textContent).toContain("9:00 AM");
  });

  it("names the speaker when the event has more than one assigned speaker", () => {
    render(
      <SessionTimeline
        modules={[module(1, "Keynote", "09:00:00", "10:00:00", "Ada Lovelace")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={2}
        now={NOW}
      />,
    );

    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
  });

  it("leaves the speaker unnamed for a single-speaker event", () => {
    render(
      <SessionTimeline
        modules={[module(1, "Keynote", "09:00:00", "10:00:00", "Ada Lovelace")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        now={NOW}
      />,
    );

    expect(screen.queryByText(/Ada Lovelace/)).toBeNull();
  });

  it("renders event start and end bookends when event times are provided", () => {
    render(
      <SessionTimeline
        modules={[module(1, "Keynote", "10:00:00", "11:00:00")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        eventStartTime="09:00:00"
        eventEndTime="12:00:00"
        now={NOW}
      />,
    );

    expect(screen.getByText("Event start")).toBeTruthy();
    expect(screen.getByText("Event end")).toBeTruthy();
    expect(screen.getByText("9:00 AM")).toBeTruthy();
    expect(screen.getByText("12:00 PM")).toBeTruthy();
  });

  it("hides bookends when event times are not provided", () => {
    render(
      <SessionTimeline
        modules={[module(1, "Keynote", "09:00:00", "10:00:00")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        now={NOW}
      />,
    );

    expect(screen.queryByText("Event start")).toBeNull();
    expect(screen.queryByText("Event end")).toBeNull();
  });

  it("renders a progress bar that fills based on event time", () => {
    const { container } = render(
      <SessionTimeline
        modules={[module(1, "Keynote", "09:00:00", "10:00:00")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        eventStartTime="09:00:00"
        eventEndTime="12:00:00"
        now={NOW}
      />,
    );

    const fill = container.querySelector('[class*="bg-brand"][class*="transition"]') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.height).toBeTruthy();
  });

  it("fills the progress bar to 100% when the event has ended", () => {
    const { container } = render(
      <SessionTimeline
        modules={[module(1, "Keynote", "09:00:00", "10:00:00")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        eventStartTime="09:00:00"
        eventEndTime="12:00:00"
        now={new Date("2026-09-01T13:00:00")}
      />,
    );

    const fill = container.querySelector('[class*="bg-brand"][class*="transition"]') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.height).toBe("100%");
  });

  it("fills the progress bar to 0% before the event starts", () => {
    const { container } = render(
      <SessionTimeline
        modules={[module(1, "Keynote", "09:00:00", "10:00:00")]}
        eventDate={EVENT_DATE}
        assignedSpeakerCount={1}
        eventStartTime="09:00:00"
        eventEndTime="12:00:00"
        now={new Date("2026-09-01T08:00:00")}
      />,
    );

    const fill = container.querySelector('[class*="bg-brand"][class*="transition"]') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.height).toBe("0%");
  });
});
