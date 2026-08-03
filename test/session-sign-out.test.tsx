// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const replace = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh }) }));

const signOut = vi.fn().mockResolvedValue({ error: null });
let emit: (event: AuthChangeEvent, session: Session | null) => void = () => {};

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signOut,
      onAuthStateChange: (cb: typeof emit) => {
        emit = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

import { SessionProvider, useSession } from "@/modules/auth/components/session-context";

function SignOutButton() {
  const { signOut: doSignOut } = useSession();
  return <button onClick={() => doSignOut()}>Sign out</button>;
}

function renderProvider() {
  return render(
    <SessionProvider>
      <SignOutButton />
    </SessionProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SessionProvider sign-out", () => {
  it("sends a signed-out client home instead of refreshing the guarded route it is on", async () => {
    renderProvider();

    act(() => emit("SIGNED_OUT", null));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("leaves an anonymous visitor where they are — INITIAL_SESSION carries a null session", async () => {
    renderProvider();

    act(() => emit("INITIAL_SESSION", null));

    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("refreshes the server render when a session arrives", async () => {
    renderProvider();

    act(() => emit("SIGNED_IN", { user: { id: "u1" } } as unknown as Session));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it("navigates home from signOut() rather than pushing the guarded page onto history", async () => {
    renderProvider();

    await act(async () => {
      screen.getByText("Sign out").click();
    });

    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
    expect(push).not.toHaveBeenCalled();
  });
});
