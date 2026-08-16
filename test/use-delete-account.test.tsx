// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";

const signOut = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => ({ signOut }),
}));

import { useDeleteAccount } from "@/modules/user/lib/use-delete-account";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function stubFetch() {
  const fn = vi.fn<FetchFn>(() => Promise.resolve({ ok: true, json: async () => ({}) } as Response));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useDeleteAccount phrase gate", () => {
  it("enables confirm only when the phrase matches exactly, whitespace-trimmed", () => {
    const { result } = renderHook(() => useDeleteAccount());

    expect(result.current.canConfirm).toBe(false);
    act(() => result.current.setPhrase("delete"));
    expect(result.current.canConfirm).toBe(false);
    act(() => result.current.setPhrase("delete my account"));
    expect(result.current.canConfirm).toBe(false);
    act(() => result.current.setPhrase("Delete My Account extra"));
    expect(result.current.canConfirm).toBe(false);
    act(() => result.current.setPhrase("  Delete My Account  "));
    expect(result.current.canConfirm).toBe(true);
  });
});

describe("useDeleteAccount confirm", () => {
  it("sends DELETE /api/auth/me with no body when the phrase matches", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useDeleteAccount());

    act(() => result.current.setPhrase("Delete My Account"));
    await act(async () => {
      await result.current.confirm();
    });

    const del = fetch.mock.calls.find((c) => String(c[0]) === "/api/auth/me");
    expect(del).toBeTruthy();
    expect(del![1]?.method).toBe("DELETE");
    expect(del![1]?.body).toBeUndefined();
  });

  it("does not fetch while the phrase does not match", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useDeleteAccount());

    await act(async () => {
      await result.current.confirm();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("sets a retryable error and keeps the dialog open when the server refuses", async () => {
    const fetch = stubFetch();
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "nope" }) } as Response);
    const { result } = renderHook(() => useDeleteAccount());

    act(() => result.current.openDialog());
    act(() => result.current.setPhrase("Delete My Account"));
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.error).toBe("We could not delete your account. Please try again.");
    expect(result.current.open).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });

  it("sets an error when the fetch itself throws", async () => {
    const fetch = stubFetch();
    fetch.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useDeleteAccount());

    act(() => result.current.setPhrase("Delete My Account"));
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.error).toBe("We could not delete your account. Please try again.");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("closes the dialog, signs out and swallows a sign-out rejection on success", async () => {
    const fetch = stubFetch();
    signOut.mockRejectedValue(new Error("token gone"));
    const { result } = renderHook(() => useDeleteAccount());

    act(() => result.current.openDialog());
    expect(result.current.phrase).toBe("");
    expect(result.current.error).toBeNull();

    act(() => result.current.setPhrase("Delete My Account"));
    await act(async () => {
      await result.current.confirm();
    });

    expect(fetch.mock.calls.find((c) => c[1]?.method === "DELETE")).toBeTruthy();
    expect(result.current.open).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it("resets the typed phrase and error when opened again", async () => {
    const { result } = renderHook(() => useDeleteAccount());

    act(() => result.current.openDialog());
    act(() => result.current.setPhrase("Delete My Account"));
    expect(result.current.canConfirm).toBe(true);

    act(() => result.current.closeDialog());
    act(() => result.current.openDialog());

    expect(result.current.phrase).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.canConfirm).toBe(false);
  });
});
