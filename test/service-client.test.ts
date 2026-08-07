import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * The service client is process-wide state, so each case re-imports the module
 * fresh rather than inheriting whichever client a previous case built.
 */
async function freshClientModule() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  return import("@/shared/db/client");
}

describe("getServiceClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("hands every caller the same client", async () => {
    const { getServiceClient } = await freshClientModule();

    const clients = new Set(Array.from({ length: 50 }, () => getServiceClient()));

    expect(clients.size).toBe(1);
  });

  it("starts no auto-refresh interval", async () => {
    const started: unknown[] = [];
    const realSetInterval = globalThis.setInterval;
    vi.spyOn(globalThis, "setInterval").mockImplementation(((...args: Parameters<typeof realSetInterval>) => {
      const timer = realSetInterval(...args);
      started.push(timer);
      return timer;
    }) as typeof realSetInterval);

    const { getServiceClient } = await freshClientModule();
    for (let i = 0; i < 25; i++) getServiceClient();
    // GoTrue arms the ticker from an async initialize(), not the constructor.
    await new Promise((resolve) => realSetInterval(resolve, 50));

    for (const timer of started) clearInterval(timer as Parameters<typeof clearInterval>[0]);

    // Such a ticker is never cleared, and it roots the whole client graph:
    // GoTrueClient holds the auth-state emitter, which holds the SupabaseClient.
    expect(started).toHaveLength(0);
  });
});
