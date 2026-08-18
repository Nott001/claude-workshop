// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { EditEventForm } from "@/modules/events/components/edit-event-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const stored = {
  title: "Launch Day",
  event_type: "online",
  event_date: "2026-09-01",
  start_time: "09:00:00",
  end_time: "17:00:00",
  venue_name: "Zoom",
  meeting_url: "https://meet.google.com/set-by-a-facilitator",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, title: "Launch Day" }) }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EditEventForm and the meeting link", () => {
  it("never sends meeting_url, so a save cannot revert a link posted meanwhile", async () => {
    render(<EditEventForm eventId="1" initialData={stored} />);

    fireEvent.change(screen.getByLabelText(/^Title$/), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);

    expect(url).toBe("/api/events/1");
    expect("meeting_url" in body).toBe(false);
    // Everything else this form owns still goes.
    expect(body.title).toBe("Renamed");
    expect(body.event_type).toBe("online");
  });

  it("still sends the mode, which is what clears the link server-side", async () => {
    render(<EditEventForm eventId="1" initialData={stored} />);

    fireEvent.click(screen.getByRole("radio", { name: /onsite/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);

    // updateEvent nulls meeting_url when the mode flips, so the form does not
    // have to carry the column to get it cleared.
    expect(body.event_type).toBe("onsite");
    expect("meeting_url" in body).toBe(false);
  });
});
