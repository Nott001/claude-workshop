// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAuditLogs } from "@/modules/audit/lib/use-audit-logs";
import { useEmailLogs } from "@/shared/integrations/email/use-email-logs";
import { usePayments } from "@/modules/commerce/lib/use-payments";
import { TicketCard } from "@/modules/commerce/components/ticket-card";
import type { Ticket } from "@/modules/commerce/lib/use-tickets";

vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => ({ user: null, loading: false, isLoaded: true, isSignedIn: true }),
}));

// AUDIT_LOG, EMAIL_LOG, PAYMENT and TICKET all key on `id`. Each of these
// surfaces used to invent a different name for it — `log_id`, `payment_id` —
// so every row rendered with an undefined React key.
const auditRows = [
  {
    id: 11,
    action: "event.created",
    entity_type: "event",
    entity_id: 1,
    metadata: null,
    created_at: "2026-08-01",
    ACTOR: null,
  },
  {
    id: 12,
    action: "event.updated",
    entity_type: "event",
    entity_id: 1,
    metadata: null,
    created_at: "2026-08-02",
    ACTOR: null,
  },
];
const emailRows = [
  { id: 21, email_type: "ticket_issued", status: "sent", sent_at: "2026-08-01", USER: { full_name: "Ada", email: "a@e.com" } },
  { id: 22, email_type: "check_in_confirmed", status: "failed", sent_at: null, USER: null },
];
const paymentRows = [
  { id: 31, status: "paid", created_at: "2026-08-01", paid_at: "2026-08-01", EVENT: { title: "Alpha" } },
  { id: 32, status: "pending", created_at: "2026-08-02", paid_at: null, EVENT: null },
];

const ticket: Ticket = {
  id: 41,
  payment_id: 99,
  user_id: 5,
  event_id: 7,
  qr_token: "tok",
  status: "issued",
  issued_at: "2026-08-01T00:00:00Z",
  checked_in_by: null,
  checked_in_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  EVENT: {
    title: "The Best Event",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "StartupLab",
    venue_address: "123 Main St",
    price: 1500,
    currency: "PHP",
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => vi.clearAllMocks());

describe("log list keys", () => {
  it("gives every audit row a defined, distinct id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ logs: auditRows, total: 2 }) }));

    const { result } = renderHook(() => useAuditLogs());

    await waitFor(() => expect(result.current.logs).toHaveLength(2));
    const keys = result.current.logs.map((l) => l.id);
    expect(keys).toEqual([11, 12]);
    expect(keys.some((k) => k === undefined)).toBe(false);
  });

  it("gives every email row a defined, distinct id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: emailRows, total: 2, page: 1, limit: 50 }) }),
    );

    const { result } = renderHook(() => useEmailLogs());

    await waitFor(() => expect(result.current.logs).toHaveLength(2));
    expect(result.current.logs.map((l) => l.id)).toEqual([21, 22]);
  });
});

describe("usePayments", () => {
  it("keys on id and reads the singular EVENT embed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: paymentRows, total: 2, page: 1, limit: 50 }) }),
    );

    const { result } = renderHook(() => usePayments());

    await waitFor(() => expect(result.current.payments).toHaveLength(2));
    expect(result.current.payments.map((p) => p.id)).toEqual([31, 32]);
    // Read as EVENTS, this was undefined and every row showed "Unknown".
    expect(result.current.payments[0].EVENT?.title).toBe("Alpha");
  });
});

describe("TicketCard", () => {
  it("renders the event from the EVENT embed instead of throwing on EVENTS", () => {
    render(<TicketCard ticket={ticket} />);

    expect(screen.getByText("The Best Event")).toBeTruthy();
    expect(screen.getByText("StartupLab, 123 Main St")).toBeTruthy();
    expect(screen.getByText("PHP 1,500.00")).toBeTruthy();
  });

  it("shows the check-in code and hides payment bookkeeping", () => {
    render(<TicketCard ticket={ticket} />);

    expect(screen.getByText("tok")).toBeTruthy();
    expect(screen.queryByText(/Payment #/)).toBeNull();
    expect(screen.queryByText(/Issued/)).toBeNull();
    expect(screen.queryByText(/Paid/)).toBeNull();
  });

  it("degrades instead of crashing when the embed comes back null", () => {
    render(<TicketCard ticket={{ ...ticket, EVENT: null }} />);

    expect(screen.getByText("Event unavailable")).toBeTruthy();
  });
});
