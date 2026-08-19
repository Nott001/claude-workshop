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

import { subscribeToModuleLock, subscribeToQaMessagesByModule } from "@/modules/courses/qa/lib/realtime";
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

    captureHandler()({ eventType: "UPDATE", new: { id: 42 } });

    expect(onUpdate).toHaveBeenCalledWith({ id: 42 });
  });

  it("fires onDelete with the old row on DELETE", () => {
    const onDelete = vi.fn();
    subscribeToQaMessagesByModule(4, { onDelete });

    captureHandler()({ eventType: "DELETE", old: { id: 43, module_id: 4 } });

    expect(onDelete).toHaveBeenCalledWith({ id: 43, module_id: 4 });
  });
});

describe("subscribeToModuleLock", () => {
  it("subscribes to MODULE updates scoped to the module", () => {
    subscribeToModuleLock(4, vi.fn());

    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "MODULE", filter: "id=eq.4" }),
      expect.any(Function),
    );
  });

  it("uses a stable channel name per module", () => {
    subscribeToModuleLock(4, vi.fn());
    subscribeToModuleLock(9, vi.fn());

    expect(channel.mock.calls[0][0]).toBe("module-lock-4");
    expect(channel.mock.calls[1][0]).toBe("module-lock-9");
  });

  it("fires onLockChange with the new is_locked on UPDATE", () => {
    const onLockChange = vi.fn();
    subscribeToModuleLock(4, onLockChange);

    captureHandler()({ eventType: "UPDATE", new: { id: 4, is_locked: true } });

    expect(onLockChange).toHaveBeenCalledWith(true);
  });

  it("ignores an UPDATE that carries no boolean lock", () => {
    const onLockChange = vi.fn();
    subscribeToModuleLock(4, onLockChange);

    captureHandler()({ eventType: "UPDATE", new: { id: 4 } });
    captureHandler()({ eventType: "UPDATE", new: { id: 4, is_locked: null } });

    expect(onLockChange).not.toHaveBeenCalled();
  });
});
