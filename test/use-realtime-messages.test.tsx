// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";

const { getBrowserClient, unsubscribe } = vi.hoisted(() => ({
  getBrowserClient: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/shared/db/browser-client", () => ({ getBrowserClient }));
vi.mock("@/shared/integrations/realtime", () => ({ unsubscribe }));

import { useRealtimeMessages } from "@/modules/chat/lib/use-realtime-messages";

interface ChannelMock {
  name: string;
  fire: (payload: { eventType: string; new?: unknown; old?: unknown }) => void;
  onConfig: { event: string; schema: string; table: string; filter: string };
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

let channels: ChannelMock[] = [];

function makeClient() {
  channels = [];
  getBrowserClient.mockReturnValue({
    channel: vi.fn((name: string) => {
      let handler: (payload: unknown) => void = () => {};
      const c: ChannelMock = {
        name,
        fire: (payload) => handler(payload),
        onConfig: { event: "", schema: "", table: "", filter: "" },
        on: vi.fn((event: string, config: unknown, h: (payload: unknown) => void) => {
          c.onConfig = { event, schema: "public", ...(config as Omit<typeof c.onConfig, "event" | "schema">) };
          handler = h;
          return c;
        }),
        subscribe: vi.fn(() => c),
      };
      channels.push(c);
      return c;
    }),
  });
}

const ENRICHED = { id: 42, user_id: 5, message: "hi", USER: { full_name: "Ana", role: "attendee" } };

function stubEnrichedFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ENRICHED })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  makeClient();
  stubEnrichedFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useRealtimeMessages", () => {
  it("subscribes to CHAT_MESSAGE changes on a stable channel", () => {
    renderHook(() =>
      useRealtimeMessages({
        channelName: "chat-panel-general",
        filter: "support_type=eq.general",
        onInsert: vi.fn(),
      }),
    );

    expect(getBrowserClient().channel).toHaveBeenCalledWith("chat-panel-general");
    expect(channels[0].onConfig).toEqual({
      event: "*",
      schema: "public",
      table: "CHAT_MESSAGE",
      filter: "support_type=eq.general",
    });
    expect(channels[0].subscribe).toHaveBeenCalled();
  });

  it("remounts on the same channel name without accumulating channels", () => {
    const { unmount } = renderHook(() =>
      useRealtimeMessages({
        channelName: "chat-panel-general",
        filter: "support_type=eq.general",
        onInsert: vi.fn(),
      }),
    );
    const first = channels[0];
    unmount();

    expect(unsubscribe).toHaveBeenCalledWith(first);

    renderHook(() =>
      useRealtimeMessages({
        channelName: "chat-panel-general",
        filter: "support_type=eq.general",
        onInsert: vi.fn(),
      }),
    );

    // Strict mode removes then re-creates the same topic rather than leaking a
    // fresh channel per mount.
    expect(channels).toHaveLength(2);
    expect(channels[0].name).toBe(channels[1].name);
  });

  it("tears the subscription down through removeChannel on unmount", () => {
    const { unmount } = renderHook(() =>
      useRealtimeMessages({ channelName: "support-inbox-general", filter: "x=eq.y", onInsert: vi.fn() }),
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe.mock.calls[0][0]).toBe(channels[0]);
  });

  it("does not subscribe before a closed panel enables it", () => {
    renderHook(() =>
      useRealtimeMessages({
        channelName: "support-panel-general",
        filter: "support_type=eq.general",
        enabled: false,
        onInsert: vi.fn(),
      }),
    );

    expect(getBrowserClient().channel).not.toHaveBeenCalled();
  });

  it("enriches an INSERT through the support endpoint before appending", async () => {
    const onInsert = vi.fn();
    renderHook(() =>
      useRealtimeMessages({
        channelName: "chat-general",
        filter: "support_type=eq.general",
        onInsert,
      }),
    );

    channels[0].fire({ eventType: "INSERT", new: { id: 42, user_id: 5 } });

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/support/42");
    expect(onInsert).toHaveBeenCalledWith(ENRICHED);
  });

  it("skips an INSERT the relevance gate rejects", async () => {
    const onInsert = vi.fn();
    const relevant = vi.fn(() => false);
    renderHook(() =>
      useRealtimeMessages({
        channelName: "support-inbox-general",
        filter: "support_type=eq.general",
        relevant,
        onInsert,
      }),
    );

    channels[0].fire({ eventType: "INSERT", new: { id: 42 } });

    await waitFor(() => expect(relevant).toHaveBeenCalledTimes(1));
    expect(fetch).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("does not append when the enrichment fetch misses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => null })),
    );
    const onInsert = vi.fn();
    renderHook(() => useRealtimeMessages({ channelName: "chat-general", filter: "support_type=eq.general", onInsert }));

    channels[0].fire({ eventType: "INSERT", new: { id: 42 } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("routes UPDATE and DELETE events to their handlers", async () => {
    const onInsert = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    renderHook(() =>
      useRealtimeMessages({
        channelName: "chat-general",
        filter: "support_type=eq.general",
        onInsert,
        onUpdate,
        onDelete,
      }),
    );

    channels[0].fire({ eventType: "UPDATE", new: { id: 42, deleted_at: "2026-08-05T10:00:00Z" } });
    channels[0].fire({ eventType: "DELETE", old: { id: 43 } });

    expect(onUpdate).toHaveBeenCalledWith({ id: 42, deleted_at: "2026-08-05T10:00:00Z" });
    expect(onDelete).toHaveBeenCalledWith({ id: 43 });
    expect(onInsert).not.toHaveBeenCalled();
  });
});
