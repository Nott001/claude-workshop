// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";

const sessionValue = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => sessionValue(),
}));

const sessionUpdateUser = vi.fn();

const updateUser = vi.fn();
vi.mock("@/shared/db/browser-client", () => ({
  getBrowserClient: () => ({ auth: { updateUser } }),
}));

import { useAccountSettings } from "@/modules/user/lib/use-account-settings";

const speaker = { id: 1, role: ROLES.SPEAKER, full_name: "Ada", email: "ada@example.com", profile_image_url: null };

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function stubFetch() {
  const fn = vi.fn<FetchFn>(() => Promise.resolve({ ok: true, json: async () => ({}) } as Response));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function response(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

const submitEvent = { preventDefault: () => {} } as React.FormEvent;

beforeEach(() => {
  vi.clearAllMocks();
  sessionValue.mockReturnValue({ user: speaker, updateUser: sessionUpdateUser });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAccountSettings", () => {
  it("saves the name via PATCH /api/auth/me and toasts success", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("New Name"));
    await act(async () => {
      await result.current.saveName(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "New Name" });
    expect(result.current.toast).toEqual({
      title: "Profile updated",
      description: "Your name has been saved.",
      type: "success",
    });
  });

  it("pushes the saved name into the session so the navbar follows", async () => {
    stubFetch().mockImplementation(() => response({ ...speaker, full_name: "Grace Hopper" }));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("Grace Hopper"));
    await act(async () => {
      await result.current.saveName(submitEvent);
    });

    expect(sessionUpdateUser).toHaveBeenCalledWith({ full_name: "Grace Hopper" });
  });

  it("sends a trimmed name and keeps the field on what was stored", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("  Grace Hopper  "));
    await act(async () => {
      await result.current.saveName(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Grace Hopper" });
    expect(result.current.name).toBe("Grace Hopper");
  });

  it("leaves the session alone when the save fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "boom" }, false));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("Grace Hopper"));
    await act(async () => {
      await result.current.saveName(submitEvent);
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
  });

  it("toasts an error when saving the name fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "boom" }, false));
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.saveName(submitEvent);
    });

    expect(result.current.toast).toEqual({ title: "Error", description: "Failed to update profile.", type: "error" });
  });

  it("updates the email in supabase, mirrors it to /api/auth/me, and reports sent", async () => {
    updateUser.mockResolvedValue({ error: null });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("new@example.com"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ email: "new@example.com" });
    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ email: "new@example.com" });
    expect(result.current.emailSent).toBe(true);
  });

  it("toasts the supabase error and skips the PATCH when the email update fails", async () => {
    updateUser.mockResolvedValue({ error: { message: "Email already in use" } });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(result.current.toast).toEqual({ title: "Error", description: "Email already in use", type: "error" });
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
  });

  it("updates the password and clears the fields on success", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword("new-pass");
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ password: "new-pass" });
    expect(result.current.currentPassword).toBe("");
    expect(result.current.newPassword).toBe("");
    expect(result.current.toast).toEqual({
      title: "Password updated",
      description: "Your password has been changed.",
      type: "success",
    });
  });

  it("uploads the photo and updates the session user's profile_image_url", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation((url: string | URL | Request) =>
      response(String(url).includes("/api/upload/profile-image") ? { url: "https://cdn.example/x.jpg" } : {}),
    );
    const { result } = renderHook(() => useAccountSettings());

    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.changeProfilePhoto({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    const post = fetch.mock.calls.find((c) => String(c[0]).includes("/api/upload/profile-image"));
    expect(post).toBeTruthy();
    expect(post![1]!.body).toBeInstanceOf(FormData);
    expect(sessionUpdateUser).toHaveBeenCalledWith({ profile_image_url: "https://cdn.example/x.jpg" });
  });

  it("hands the uploaded URL back through the session so the settings preview updates", async () => {
    let user = speaker;
    sessionUpdateUser.mockImplementation((patch) => {
      user = { ...user, ...patch };
    });
    sessionValue.mockImplementation(() => ({ user, updateUser: sessionUpdateUser }));
    const fetch = stubFetch();
    fetch.mockImplementation((url: string | URL | Request) =>
      response(String(url).includes("/api/upload/profile-image") ? { url: "https://cdn.example/x.jpg" } : {}),
    );
    const { result, rerender } = renderHook(() => useAccountSettings());

    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.changeProfilePhoto({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    rerender();
    expect(result.current.currentUser?.profile_image_url).toBe("https://cdn.example/x.jpg");
  });

  it("leaves the session photo alone when the upload fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "too large" }, false));
    const { result } = renderHook(() => useAccountSettings());

    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.changeProfilePhoto({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
    expect(result.current.toast?.type).toBe("error");
  });
});
