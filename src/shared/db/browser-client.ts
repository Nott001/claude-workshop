import { createBrowserClient } from "@supabase/ssr";
import type { DbClient } from "./dao/types";

// The client for anything running in the browser. createBrowserClient caches a
// singleton per browser context, so this returns the same instance the auth code
// already uses and there is exactly one GoTrueClient on the page.
//
// Client components must not import `supabase` from ./client: that one is a
// plain supabase-js client with its own GoTrueClient, and two of them against
// the same `sb-<ref>-auth-token` storage key race on token refresh. auth-js
// only serialises refreshes when a lock is passed explicitly, and neither
// client passes one.

// Dev-only tallies backing the runtime profiler: the browser cannot enumerate
// open realtime channels, so the client counts them here as they are made and
// removed. Wrapping is idempotent per instance, since getBrowserClient returns
// the cached singleton every call.
const wrappedClients = new WeakSet<DbClient>();
let realtimeChannels = 0;

export function getRealtimeChannelCount(): number {
  return realtimeChannels;
}

function trackChannels(client: DbClient): DbClient {
  if (process.env.NODE_ENV === "production" || wrappedClients.has(client)) return client;
  wrappedClients.add(client);

  const channel = client.channel.bind(client);
  const removeChannel = client.removeChannel.bind(client);

  client.channel = ((...args: Parameters<typeof channel>) => {
    realtimeChannels++;
    return channel(...args);
  }) as typeof client.channel;

  client.removeChannel = ((target) => {
    if (realtimeChannels > 0) realtimeChannels--;
    return removeChannel(target);
  }) as typeof client.removeChannel;

  return client;
}

export function getBrowserClient(): DbClient {
  return trackChannels(createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
}
