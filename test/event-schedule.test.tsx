// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EventSchedule } from "@/modules/events/components/event-schedule";

const fetchMock = vi.fn();

function ok(json: unknown) {
  return Promise.resolve({ ok: true, json: async () => json });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventSchedule", () => {
  it("renders a row per module with the formatted time and module name", async () => {
    fetchMock.mockReturnValue(
      ok({
        modules: [
          { id: 1, module_name: "Introduction", start_time: "09:00", end_time: "10:00", speaker: "John Doe" },
          { id: 2, module_name: "Break", start_time: null, end_time: null, speaker: null },
        ],
      }),
    );
    render(<EventSchedule eventId="7" />);

    expect(await screen.findByText("Introduction")).toBeTruthy();
    expect(screen.getByText("9:00 AM")).toBeTruthy();
    expect(screen.getByText("Break")).toBeTruthy();
  });

  it("reveals the speaker on toggle and omits the line for a speaker-less module", async () => {
    fetchMock.mockReturnValue(
      ok({
        modules: [
          { id: 1, module_name: "Introduction", start_time: "09:00", end_time: "10:00", speaker: "John Doe" },
          { id: 2, module_name: "Break", start_time: "10:30", end_time: "10:45", speaker: null },
        ],
      }),
    );
    render(<EventSchedule eventId="7" />);

    const trigger = await screen.findByRole("button", { name: /introduction/i });
    expect(screen.queryByText("Speaker: John Doe")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByText("Speaker: John Doe")).toBeTruthy();

    expect(screen.queryByRole("button", { name: /break/i })).toBeNull();
    expect(screen.queryByText(/Speaker:/)).toBeTruthy();
  });

  it("renders the card with a notice when the event has no scheduled modules", async () => {
    fetchMock.mockReturnValue(ok({ modules: [] }));
    render(<EventSchedule eventId="7" />);

    expect(await screen.findByText("No schedule yet.")).toBeTruthy();
    expect(screen.getByText("Course schedule")).toBeTruthy();
  });

  it("renders the card with an error when the schedule fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<EventSchedule eventId="7" />);

    expect(await screen.findByText("Couldn't load the schedule.")).toBeTruthy();
    expect(screen.getByText("Course schedule")).toBeTruthy();
  });

  it("renders the card with an error when the schedule fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<EventSchedule eventId="7" />);

    expect(await screen.findByText("Couldn't load the schedule.")).toBeTruthy();
    expect(screen.getByText("Course schedule")).toBeTruthy();
  });

  it("expands and collapses the speaker detail, toggling aria-expanded", async () => {
    fetchMock.mockReturnValue(
      ok({
        modules: [{ id: 1, module_name: "Introduction", start_time: "09:00", end_time: "10:00", speaker: "John Doe" }],
      }),
    );
    render(<EventSchedule eventId="7" />);

    const trigger = await screen.findByRole("button", { name: /introduction/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Speaker: John Doe")).toBeTruthy();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Speaker: John Doe")).toBeNull();
  });
});
