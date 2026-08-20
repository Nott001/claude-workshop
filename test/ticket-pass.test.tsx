// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { TicketPass } from "@/modules/commerce/components/ticket-pass";
import TicketPassPage from "@/app/tickets/[ticketId]/page";
import { subscribeToTicket } from "@/shared/integrations/realtime";
import type { TicketWithEvent } from "@/shared/db/dao/ticket.dao";

vi.mock("next/navigation", () => ({
  useParams: () => ({ ticketId: "42" }),
}));

vi.mock("@/shared/integrations/realtime", () => ({
  subscribeToTicket: vi.fn(),
  unsubscribe: vi.fn(),
}));

const ticket: TicketWithEvent = {
  id: 42,
  payment_id: 99,
  user_id: 5,
  event_id: 7,
  qr_token: "tok-123",
  status: "issued",
  issued_at: "2026-08-01T00:00:00Z",
  checked_in_by: null,
  checked_in_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  EVENT: {
    title: "Launch Day",
    event_date: "2026-09-01",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Main Hall",
    venue_address: "1 Street",
    price: 1500,
    currency: "PHP",
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

beforeEach(() => vi.clearAllMocks());

describe("TicketPass", () => {
  it("shows the event title, the check-in code, and the Registered badge", () => {
    render(<TicketPass ticket={ticket} />);

    expect(screen.getByText("Launch Day")).toBeTruthy();
    expect(screen.getByText("tok-123")).toBeTruthy();
    expect(screen.getByText("Registered")).toBeTruthy();
    expect(screen.getByText("Present this QR code at the entrance for check-in.")).toBeTruthy();
  });

  it("shows Checked in with the updated_at time when checked in", () => {
    const checkedInAt = "2026-08-14T10:00:00.000Z";
    const expectedTime = new Date(checkedInAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    render(<TicketPass ticket={{ ...ticket, status: "checked_in", updated_at: checkedInAt }} />);

    expect(screen.getByText(`Checked in · ${expectedTime}`)).toBeTruthy();
  });

  it("shows Cancelled when cancelled", () => {
    render(<TicketPass ticket={{ ...ticket, status: "cancelled" }} />);

    expect(screen.getByText("Cancelled")).toBeTruthy();
  });
});

describe("TicketPassPage", () => {
  it("flips the banner to Checked in when the live event arrives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ticket }));

    render(<TicketPassPage />);

    expect(await screen.findByText("Registered")).toBeTruthy();

    // The page subscribes in a passive effect that flushes after the commit
    // that paints "Registered"; wait for it so the callback is actually there.
    const subscribeToTicketMock = vi.mocked(subscribeToTicket);
    await waitFor(() => expect(subscribeToTicketMock).toHaveBeenCalledWith(42, expect.any(Function)));
    const onTicket = subscribeToTicketMock.mock.calls[0][1];
    const checkedInAt = "2026-08-14T11:30:00.000Z";
    const expectedTime = new Date(checkedInAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    onTicket({ ...ticket, status: "checked_in", updated_at: checkedInAt });

    await waitFor(() => expect(screen.getByText(`Checked in · ${expectedTime}`)).toBeTruthy());
  });
});
