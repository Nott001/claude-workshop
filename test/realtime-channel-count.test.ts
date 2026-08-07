import { describe, it, expect, vi } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";

const { channel, removeChannel } = vi.hoisted(() => ({
  channel: vi.fn(() => ({ on: () => ({ subscribe: () => {} }) })),
  removeChannel: vi.fn(() => Promise.resolve("ok" as const)),
}));

const { client } = vi.hoisted(() => ({ client: { channel, removeChannel } }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => client,
}));

import { getBrowserClient, getRealtimeChannelCount } from "@/shared/db/browser-client";

const fakeChannel = {} as RealtimeChannel;

describe("realtime channel counting", () => {
  it("counts every channel created through the client", () => {
    const before = getRealtimeChannelCount();

    getBrowserClient().channel("topic-a");
    getBrowserClient().channel("topic-b");

    expect(getRealtimeChannelCount() - before).toBe(2);
  });

  it("decrements when a channel is removed", () => {
    const browser = getBrowserClient();
    browser.channel("topic");
    const before = getRealtimeChannelCount();

    browser.removeChannel(fakeChannel);

    expect(getRealtimeChannelCount()).toBe(before - 1);
  });

  it("wraps the shared client exactly once", () => {
    const browser = getBrowserClient();
    const before = getRealtimeChannelCount();

    browser.channel("topic");

    expect(getRealtimeChannelCount() - before).toBe(1);
  });

  it("never decrements below zero", () => {
    const browser = getBrowserClient();
    browser.removeChannel(fakeChannel);

    expect(getRealtimeChannelCount()).toBeGreaterThanOrEqual(0);
  });
});
