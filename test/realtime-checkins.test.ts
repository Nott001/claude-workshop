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

import { subscribeToCheckins } from "@/shared/integrations/realtime";
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

describe("subscribeToCheckins", () => {
  it("subscribes to TICKET UPDATEs scoped to the event", () => {
    subscribeToCheckins(7, vi.fn());

    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "TICKET", filter: "event_id=eq.7" }),
      expect.any(Function),
    );
  });

  it("uses a channel name starting with checkins-<eventId>", () => {
    subscribeToCheckins(7, vi.fn());

    expect(channel.mock.calls[0][0]).toMatch(/^checkins-7-/);
  });

  it("fires onCheckin only when the new status is checked_in", () => {
    const onCheckin = vi.fn();
    subscribeToCheckins(7, onCheckin);

    captureHandler()({ eventType: "UPDATE", new: { status: "issued" } });
    expect(onCheckin).not.toHaveBeenCalled();

    captureHandler()({ eventType: "UPDATE", new: { status: "cancelled" } });
    expect(onCheckin).not.toHaveBeenCalled();

    captureHandler()({ eventType: "UPDATE", new: { status: "checked_in" } });
    expect(onCheckin).toHaveBeenCalledTimes(1);
    expect(onCheckin).toHaveBeenCalledWith({ status: "checked_in" });
  });

  it("tears down through removeChannel via the shared unsubscribe", () => {
    const sub = subscribeToCheckins(7, vi.fn());

    unsubscribe(sub);

    expect(removeChannel).toHaveBeenCalledWith(sub);
  });
});
