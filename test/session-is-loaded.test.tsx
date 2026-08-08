// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import { SessionProvider, useSession } from "@/modules/auth/components/session-context";

const appUser = { id: 1, role: ROLES.ADMIN, full_name: "Ada", email: "ada@example.com", profile_image_url: null };

function Probe() {
  const { isLoaded, loading } = useSession();
  return <span data-testid="flags">{`isLoaded=${isLoaded} loading=${loading}`}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: "auth_1" } } as unknown as Session } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => appUser }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SessionProvider.isLoaded", () => {
  // The bug this pins: consumers destructured `loading` *as* `isLoaded`, so
  // `if (!isLoaded) return` bailed out exactly when the session was ready.
  // Every fetch behind such a guard never ran and the page span forever.
  it("is the opposite of loading, not an alias for it", async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(screen.getByTestId("flags").textContent).toBe("isLoaded=false loading=true");

    await waitFor(() => expect(screen.getByTestId("flags").textContent).toBe("isLoaded=true loading=false"));
  });

  it("reports loaded for an anonymous visitor too — no session is a resolved state", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("flags").textContent).toBe("isLoaded=true loading=false"));
  });
});

describe("a consumer gated on isLoaded", () => {
  it("runs its fetch once the session resolves instead of never", async () => {
    const { usePayments } = await import("@/modules/commerce/lib/use-payments");

    const rows = [{ id: 9, status: "paid", created_at: "2026-08-01", paid_at: null, EVENT: null }];
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => (String(url).startsWith("/api/payments") ? { data: rows, total: 1, page: 1, limit: 50 } : appUser),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePayments(), {
      wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
    });

    // Inverted, this stayed true forever: the guard returned the moment the
    // session was ready, so `loading` was never cleared.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.payments).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledWith("/api/payments?page=1&limit=50");
  });
});

// `loading` gates every guarded page. Left set on a failing path it spins the
// page it was gating, so the failure has to resolve to "nobody", not to limbo.
describe("SessionProvider settles on a failing session", () => {
  it("finishes loading when getSession rejects", async () => {
    getSession.mockRejectedValue(new Error("refresh token is invalid"));

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("flags").textContent).toBe("isLoaded=true loading=false"));
  });

  it("finishes loading when /api/auth/me rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("flags").textContent).toBe("isLoaded=true loading=false"));
  });
});
