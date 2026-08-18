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

import { subscribeToCourseHighlight } from "@/shared/integrations/realtime";
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

describe("subscribeToCourseHighlight", () => {
  it("subscribes to LIVE_SESSION_STATE UPDATEs scoped to the course", () => {
    subscribeToCourseHighlight(9, vi.fn());

    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "UPDATE", table: "LIVE_SESSION_STATE", filter: "course_id=eq.9" }),
      expect.any(Function),
    );
  });

  it("uses a stable channel name per course so remounts reuse one topic", () => {
    subscribeToCourseHighlight(9, vi.fn());
    subscribeToCourseHighlight(9, vi.fn());
    subscribeToCourseHighlight(14, vi.fn());

    expect(channel.mock.calls[0][0]).toBe("live-highlight-9");
    expect(channel.mock.calls[1][0]).toBe("live-highlight-9");
    expect(channel.mock.calls[2][0]).toBe("live-highlight-14");
  });

  it("emits the new highlighted lesson id on UPDATE", () => {
    const onChange = vi.fn();
    subscribeToCourseHighlight(9, onChange);

    captureHandler()({ eventType: "UPDATE", new: { course_id: 9, highlighted_lesson_id: 21 } });

    expect(onChange).toHaveBeenCalledWith(21);
  });

  it("emits null when the highlight is cleared", () => {
    const onChange = vi.fn();
    subscribeToCourseHighlight(9, onChange);

    captureHandler()({ eventType: "UPDATE", new: { course_id: 9, highlighted_lesson_id: null } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("tears down through removeChannel via the shared unsubscribe", () => {
    const sub = subscribeToCourseHighlight(9, vi.fn());

    unsubscribe(sub);

    expect(removeChannel).toHaveBeenCalledWith(sub);
  });
});
