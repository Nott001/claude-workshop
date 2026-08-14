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

import { subscribeToQaMessagesByModule } from "@/modules/courses/qa/lib/realtime";
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

describe("subscribeToQaMessagesByModule", () => {
  it("subscribes to QA_MESSAGE changes scoped to the module", () => {
    subscribeToQaMessagesByModule(4, {});

    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "QA_MESSAGE", filter: "module_id=eq.4" }),
      expect.any(Function),
    );
  });

  it("uses a stable channel name so remounts reuse one topic", () => {
    subscribeToQaMessagesByModule(4, {});
    subscribeToQaMessagesByModule(4, {});
    subscribeToQaMessagesByModule(9, {});

    const [first] = channel.mock.calls[0];
    const [second] = channel.mock.calls[1];
    const [third] = channel.mock.calls[2];
    expect(first).toBe("qa-module-4");
    expect(second).toBe("qa-module-4");
    expect(third).toBe("qa-module-9");
  });

  it("tears down through removeChannel via the shared unsubscribe", () => {
    const sub = subscribeToQaMessagesByModule(4, {});

    unsubscribe(sub);

    expect(removeChannel).toHaveBeenCalledWith(sub);
  });

  it("fires onInsert with the new row on INSERT", () => {
    const onInsert = vi.fn();
    subscribeToQaMessagesByModule(4, { onInsert });

    captureHandler()({ eventType: "INSERT", new: { id: 42, module_id: 4, message: "hi" } });

    expect(onInsert).toHaveBeenCalledWith({ id: 42, module_id: 4, message: "hi" });
  });

  it("fires onUpdate with the new row on UPDATE", () => {
    const onUpdate = vi.fn();
    subscribeToQaMessagesByModule(4, { onUpdate });

    captureHandler()({ eventType: "UPDATE", new: { id: 42, deleted_at: "2026-08-05T10:00:00Z" } });

    expect(onUpdate).toHaveBeenCalledWith({ id: 42, deleted_at: "2026-08-05T10:00:00Z" });
  });

  it("fires onDelete with the old row on DELETE", () => {
    const onDelete = vi.fn();
    subscribeToQaMessagesByModule(4, { onDelete });

    captureHandler()({ eventType: "DELETE", old: { id: 43, module_id: 4 } });

    expect(onDelete).toHaveBeenCalledWith({ id: 43, module_id: 4 });
  });
});
