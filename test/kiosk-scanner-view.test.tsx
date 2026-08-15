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
  survey_enabled: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const issuedPreview = {
  attendee: { full_name: "Jane Doe", email: "jane@example.com" },
  qr_token: "tok-123",
  status: "issued",
  checked_in_at: null,
};

function stubFetch({
  lookup,
  lookupOk = true,
  confirm,
  confirmOk = true,
}: {
  lookup: unknown;
  lookupOk?: boolean;
  confirm?: unknown;
  confirmOk?: boolean;
}) {
  const impl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("/api/checkin/lookup")) {
      return { ok: lookupOk, json: async () => lookup };
    }
    if (url.startsWith("/api/checkin")) {
      return { ok: confirmOk, json: async () => confirm };
    }
    return { ok: true, json: async () => ({ attendees: [], total: 0 }) };
  };
  vi.stubGlobal("fetch", vi.fn(impl));
}

const qrInput = () => screen.getByPlaceholderText(/Scan or type QR token/);

async function submitManualToken(token: string) {
  fireEvent.change(qrInput(), { target: { value: token } });
  fireEvent.click(screen.getByRole("button", { name: /Find Attendee/ }));
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
    stubFetch({ lookup: null });
    render(<KioskScannerView event={event} />);

    expect(screen.getByRole("button", { name: /Start Camera Scanner/ })).toBeTruthy();
    expect(qrInput()).toBeTruthy();
  });

  it("mounts the scanner and its frame when Start Camera is clicked", async () => {
    stubFetch({ lookup: null });
    const { container } = render(<KioskScannerView event={event} />);

    fireEvent.click(screen.getByRole("button", { name: /Start Camera Scanner/ }));

    await waitFor(() => {
      expect(container.querySelector("#qr-reader-container")).toBeTruthy();
    });
    expect(container.querySelector(".border-dashed")).toBeTruthy();
  });
});

describe("KioskScannerView lookup-then-confirm", () => {
  it("looks up a token and previews the attendee without checking them in", async () => {
    stubFetch({ lookup: issuedPreview });
    render(<KioskScannerView event={event} />);

    await submitManualToken("tok-123");

    expect(await screen.findByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("jane@example.com")).toBeTruthy();
    expect(screen.getByText("tok-123")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Check In/ })).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/checkin/lookup?qr_token=tok-123");
  });

  it("checks in only after the operator confirms", async () => {
    stubFetch({ lookup: issuedPreview, confirm: { status: "success" } });
    render(<KioskScannerView event={event} />);

    await submitManualToken("tok-123");
    await screen.findByRole("button", { name: /Check In/ });

    fireEvent.click(screen.getByRole("button", { name: /Check In/ }));

    expect(await screen.findByRole("button", { name: /Checked in/ })).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/checkin",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ qr_token: "tok-123" }) }),
    );
  });

  it("keeps the confirmed attendee on the card until the operator clears it", async () => {
    stubFetch({ lookup: issuedPreview, confirm: { status: "success" } });
    render(<KioskScannerView event={event} />);

    await submitManualToken("tok-123");
    await screen.findByRole("button", { name: /Check In/ });
    fireEvent.click(screen.getByRole("button", { name: /Check In/ }));

    expect(await screen.findByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("tok-123")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Done$/ }));
    expect(screen.queryByText("Jane Doe")).toBeNull();
  });

  it("shows an already-checked-in ticket without offering to write again", async () => {
    stubFetch({ lookup: { ...issuedPreview, status: "checked_in", checked_in_at: "2026-08-14T10:00:00.000Z" } });
    render(<KioskScannerView event={event} />);

    await submitManualToken("tok-123");

    expect(await screen.findByText("Already checked in")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Check In$/ })).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith("/api/checkin", expect.objectContaining({ method: "POST" }));
  });

  it("calls out a cancelled ticket without offering to write", async () => {
    stubFetch({ lookup: { ...issuedPreview, status: "cancelled" } });
    render(<KioskScannerView event={event} />);

    await submitManualToken("tok-123");

    expect(await screen.findByText("Ticket cancelled")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Check In$/ })).toBeNull();
  });

  it("treats an unrecognised token as invalid", async () => {
    stubFetch({ lookup: { error: "Invalid QR token" }, lookupOk: false });
    render(<KioskScannerView event={event} />);

    await submitManualToken("unknown-token");

    expect(await screen.findByText("Invalid ticket")).toBeTruthy();
  });
});
