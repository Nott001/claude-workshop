// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventSchedule } from "@/modules/events/components/event-schedule";

const fetchMock = vi.fn();

function ok(json: unknown) {
  return Promise.resolve({ ok: true, json: async () => json });
}

const event = { event_date: "2026-09-01", start_time: "09:00", end_time: "17:00" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventSchedule", () => {
  it("leads the timeline with the event start and closes it with the event end", async () => {
    fetchMock.mockReturnValue(ok({ modules: [] }));
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("Event starts")).toBeTruthy();
    expect(screen.getByText("9:00 AM")).toBeTruthy();
    expect(screen.getByText("Event ends")).toBeTruthy();
    expect(screen.getByText("5:00 PM")).toBeTruthy();
    expect(screen.queryByText("9:00 AM – 5:00 PM")).toBeNull();
  });

  it("renders a row per module with its full time window and inline speaker", async () => {
    fetchMock.mockReturnValue(
      ok({
        modules: [
          { id: 1, module_name: "Introduction", start_time: "09:00", end_time: "10:00", speaker: "John Doe" },
          { id: 2, module_name: "Break", start_time: "10:30", end_time: "10:45", speaker: null },
        ],
      }),
    );
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("Introduction")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 10:00 AM")).toBeTruthy();
    expect(screen.getByText("Speaker: John Doe")).toBeTruthy();
    expect(screen.getByText("10:30 AM – 10:45 AM")).toBeTruthy();
    expect(screen.getByText("Break")).toBeTruthy();
  });

  it("shows just the start edge when the module has no end time", async () => {
    fetchMock.mockReturnValue(
      ok({ modules: [{ id: 1, module_name: "Intro", start_time: "11:00", end_time: null, speaker: null }] }),
    );
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("Intro")).toBeTruthy();
    expect(screen.getByText("11:00 AM")).toBeTruthy();
  });

  it("renders a name-only row when the module has no time", async () => {
    fetchMock.mockReturnValue(
      ok({ modules: [{ id: 1, module_name: "No window", start_time: null, end_time: null, speaker: null }] }),
    );
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("No window")).toBeTruthy();
    expect(screen.getAllByText("9:00 AM").length).toBe(1);
  });

  it("omits the speaker line for a module without one", async () => {
    fetchMock.mockReturnValue(
      ok({ modules: [{ id: 1, module_name: "Intro", start_time: "09:00", end_time: "10:00", speaker: null }] }),
    );
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("Intro")).toBeTruthy();
    expect(screen.queryByText(/Speaker:/)).toBeNull();
  });

  it("renders the card with a notice when the event has no scheduled modules", async () => {
    fetchMock.mockReturnValue(ok({ modules: [] }));
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("No schedule yet.")).toBeTruthy();
    expect(screen.getByText("Course schedule")).toBeTruthy();
  });

  it("renders the card with an error when the schedule fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("Couldn't load the schedule.")).toBeTruthy();
    expect(screen.getByText("Course schedule")).toBeTruthy();
  });

  it("renders the card with an error when the schedule fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<EventSchedule eventId="7" event={event} />);

    expect(await screen.findByText("Couldn't load the schedule.")).toBeTruthy();
    expect(screen.getByText("Course schedule")).toBeTruthy();
  });
});
