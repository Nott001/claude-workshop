import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";

const { removeChannel, channel, on, subscribe } = vi.hoisted(() => {
  const on = vi.fn();
  const subscribe = vi.fn();
  return { removeChannel: vi.fn(), channel: vi.fn(), on, subscribe };
});

vi.mock("@/shared/db/browser-client", () => ({
  getBrowserClient: () => ({ channel, removeChannel }),
}));

import { subscribeToTicket } from "@/shared/integrations/realtime";
import { unsubscribe } from "@/shared/integrations/realtime";

beforeEach(() => {
  vi.clearAllMocks();
  // A channel is a fluent builder: .channel().on().subscribe() returns itself.
  const built = { on, subscribe } as unknown as RealtimeChannel;
  on.mockReturnValue(built);
  subscribe.mockReturnValue(built);
  channel.mockReturnValue(built);
});

function captureHandler(): (payload: { eventType: string; new?: unknown; old?: unknown }) => void {
  return on.mock.calls[0][2] as unknown as (payload: { eventType: string; new?: unknown; old?: unknown }) => void;
}

describe("subscribeToTicket", () => {
  it("subscribes to TICKET UPDATEs scoped to the ticket id", () => {
    subscribeToTicket(42, vi.fn());

    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "TICKET", filter: "id=eq.42" }),
      expect.any(Function),
    );
  });

  it("uses a channel name starting with ticket-<ticketId>", () => {
    subscribeToTicket(42, vi.fn());

    expect(channel.mock.calls[0][0]).toMatch(/^ticket-42-/);
  });

  it("fires onTicket only for checked_in or cancelled, not issued", () => {
    const onTicket = vi.fn();
    subscribeToTicket(42, onTicket);

    captureHandler()({ eventType: "UPDATE", new: { status: "issued" } });
    expect(onTicket).not.toHaveBeenCalled();

    captureHandler()({ eventType: "UPDATE", new: { status: "checked_in", updated_at: "2026-08-14T10:00:00.000Z" } });
    expect(onTicket).toHaveBeenNthCalledWith(1, { status: "checked_in", updated_at: "2026-08-14T10:00:00.000Z" });

    captureHandler()({ eventType: "UPDATE", new: { status: "cancelled" } });
    expect(onTicket).toHaveBeenNthCalledWith(2, { status: "cancelled" });
  });

  it("ignores an UPDATE that carries no status at all", () => {
    const onTicket = vi.fn();
    subscribeToTicket(42, onTicket);

    captureHandler()({ eventType: "UPDATE", new: { id: 42 } });

    expect(onTicket).not.toHaveBeenCalled();
  });

  it("tears down through removeChannel via the shared unsubscribe", () => {
    const sub = subscribeToTicket(42, vi.fn());

    unsubscribe(sub);

    expect(removeChannel).toHaveBeenCalledWith(sub);
  });
});
