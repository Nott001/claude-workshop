// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { KioskScannerView } from "@/modules/kiosk/components/kiosk-scanner-view";
import type { Event } from "@/shared/types";

vi.mock("html5-qrcode", () => {
  const start = vi.fn().mockResolvedValue(undefined);
  const stop = vi.fn().mockResolvedValue(undefined);
  return {
    Html5Qrcode: vi.fn(function (this: { start: typeof start; stop: typeof stop }) {
      this.start = start;
      this.stop = stop;
    }),
  };
});

vi.mock("@/shared/integrations/realtime", () => ({
  subscribeToCheckins: vi.fn(() => ({ unsubscribe: vi.fn() })),
  unsubscribe: vi.fn(),
}));

const event: Event = {
  id: 7,
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00:00",
  end_time: "17:00:00",
  venue_name: "Main Hall",
  venue_address: null,
  description: null,
  price: 0,
  currency: "PHP",
  cover_image_url: null,
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function stubFetch(checkin: unknown, checkinOk = true) {
  const impl = async (input: string | URL | Request) => {
    if (String(input).includes("/api/checkin")) {
      return { ok: checkinOk, json: async () => checkin };
    }
    return { ok: true, json: async () => ({ attendees: [], total: 0 }) };
  };
  vi.stubGlobal("fetch", vi.fn(impl));
}

const qrInput = () => screen.getByPlaceholderText(/Scan or type QR token/);

async function submitManualCheckin(token: string) {
  fireEvent.change(qrInput(), { target: { value: token } });
  fireEvent.click(screen.getByRole("button", { name: /Check In/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KioskScannerView controls", () => {
  it("shows the Start Camera button and manual check-in input", () => {
    stubFetch(null);
    render(<KioskScannerView event={event} />);

    expect(screen.getByRole("button", { name: /Start Camera Scanner/ })).toBeTruthy();
    expect(qrInput()).toBeTruthy();
  });

  it("mounts the scanner and its frame when Start Camera is clicked", async () => {
    stubFetch(null);
    const { container } = render(<KioskScannerView event={event} />);

    fireEvent.click(screen.getByRole("button", { name: /Start Camera Scanner/ }));

    await waitFor(() => {
      expect(container.querySelector("#qr-reader-container")).toBeTruthy();
    });
    expect(container.querySelector(".border-dashed")).toBeTruthy();
  });
});

describe("KioskScannerView check-in", () => {
  it("posts the QR token to /api/checkin and greets a checked-in attendee", async () => {
    stubFetch({ status: "success", attendee: { full_name: "Jane Doe", email: "jane@example.com" } });
    render(<KioskScannerView event={event} />);

    await submitManualCheckin("tok-123");

    expect(await screen.findByText("Checked in")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/checkin",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ qr_token: "tok-123" }) }),
    );
  });

  it("reports a ticket already checked in", async () => {
    stubFetch({ status: "duplicate" });
    render(<KioskScannerView event={event} />);

    await submitManualCheckin("tok-123");

    expect(await screen.findByText("Already checked in")).toBeTruthy();
  });

  it("calls out a cancelled ticket", async () => {
    stubFetch({ status: "rejected", reason: "cancelled" });
    render(<KioskScannerView event={event} />);

    await submitManualCheckin("tok-123");

    expect(await screen.findByText("Ticket cancelled")).toBeTruthy();
  });

  it("treats an unrecognised token as invalid", async () => {
    stubFetch({ error: "Invalid QR token" }, false);
    render(<KioskScannerView event={event} />);

    await submitManualCheckin("unknown-token");

    expect(await screen.findByText("Invalid ticket")).toBeTruthy();
  });
});
