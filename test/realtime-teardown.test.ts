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

import { unsubscribe, subscribeToCheckins } from "@/shared/integrations/realtime";

beforeEach(() => {
  vi.clearAllMocks();
  // A channel is a fluent builder: .channel().on().subscribe() returns itself.
  const built = { on, subscribe } as unknown as RealtimeChannel;
  on.mockReturnValue(built);
  subscribe.mockReturnValue(built);
  channel.mockReturnValue(built);
});

describe("unsubscribe", () => {
  // `channel.unsubscribe()` closes the socket topic but leaves the channel
  // registered on the client, so remounting a panel accumulates dead channels
  // until the connection hits its topic limit and new subscriptions silently
  // stop arriving. Only removeChannel does both halves.
  it("hands the channel to removeChannel rather than closing it in place", () => {
    const sub = { unsubscribe: vi.fn() } as unknown as RealtimeChannel;

    unsubscribe(sub);

    expect(removeChannel).toHaveBeenCalledWith(sub);
    expect((sub as unknown as { unsubscribe: ReturnType<typeof vi.fn> }).unsubscribe).not.toHaveBeenCalled();
  });

  it("removes the exact channel a subscribe helper returned", () => {
    const sub = subscribeToCheckins(7, vi.fn());

    unsubscribe(sub);

    expect(removeChannel).toHaveBeenCalledWith(sub);
  });
});

describe("subscribeToCheckins", () => {
  it("scopes the subscription to the event it was given", () => {
    subscribeToCheckins(7, vi.fn());

    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "TICKET", filter: "event_id=eq.7" }),
      expect.any(Function),
    );
  });

  it("names each channel uniquely so concurrent mounts do not collide", () => {
    subscribeToCheckins(7, vi.fn());
    subscribeToCheckins(7, vi.fn());

    const [first] = channel.mock.calls[0];
    const [second] = channel.mock.calls[1];
    expect(first).not.toEqual(second);
  });

  it("reports a check-in but ignores other status transitions", () => {
    const onCheckin = vi.fn();
    subscribeToCheckins(7, onCheckin);
    const handler = on.mock.calls[0][2] as (p: { new: { status: string } }) => void;

    handler({ new: { status: "issued" } });
    expect(onCheckin).not.toHaveBeenCalled();

    handler({ new: { status: "checked_in" } });
    expect(onCheckin).toHaveBeenCalledWith({ status: "checked_in" });
  });
});
