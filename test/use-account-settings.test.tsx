// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";

const sessionValue = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => sessionValue(),
}));

const sessionUpdateUser = vi.fn();

// vi.mock is hoisted above the module body, so this double must be created
// inside vi.hoisted rather than as a plain const.
const { checkMailDomain } = vi.hoisted(() => ({ checkMailDomain: vi.fn() }));
vi.mock("@/shared/integrations/dns/mail-domain", () => ({ checkMailDomain }));

const { verifyPassword } = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
vi.mock("@/modules/auth/lib/verify-password", () => ({ verifyPassword }));

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
  checkMailDomain.mockResolvedValue("deliverable");
  verifyPassword.mockResolvedValue(true);
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

  it("refuses the address already on the account without calling supabase or the API", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail(speaker.email));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(result.current.emailSent).toBe(false);
    expect(result.current.toast).toEqual({
      title: "Error",
      description: "That is already your email address.",
      type: "error",
    });
  });

  it("refuses it however it is capitalised or padded", async () => {
    const { result } = renderHook(() => useAccountSettings());

    for (const typed of ["ADA@EXAMPLE.COM", "  Ada@Example.com  "]) {
      act(() => result.current.setNewEmail(typed));
      await act(async () => {
        await result.current.changeEmail(submitEvent);
      });

      expect(updateUser).not.toHaveBeenCalled();
    }
  });

  it("sends a trimmed address so stray space cannot pass as a different one", async () => {
    updateUser.mockResolvedValue({ error: null });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("  grace@example.com  "));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ email: "grace@example.com" });
    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ email: "grace@example.com" });
  });

  it("refuses a domain with no mail server and suggests the likely typo", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@gmial.com"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(result.current.emailSent).toBe(false);
    expect(result.current.toast?.description).toBe(
      "We could not find a mail server for gmial.com. Did you mean ada@gmail.com?",
    );
  });

  it("refuses an unrecognisable dead domain without inventing a suggestion", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@nowhere-at-all.test"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(result.current.toast?.description).toBe(
      "We could not find a mail server for nowhere-at-all.test. Check the spelling.",
    );
  });

  // A resolver that is down or blocked must not be able to lock someone out of
  // changing their email; the confirmation link is the real proof.
  it("lets the change through when the lookup cannot answer", async () => {
    checkMailDomain.mockResolvedValue("unknown");
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@obscure.test"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ email: "ada@obscure.test" });
    expect(result.current.emailSent).toBe(true);
  });

  it("checks the domain only after the address is known to be a real change", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail(speaker.email));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(checkMailDomain).not.toHaveBeenCalled();
  });

  it("stops showing progress after refusing the domain", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@gmial.com"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(result.current.savingEmail).toBe(false);
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
      result.current.setNewPassword("the quiet kettle sings");
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ password: "the quiet kettle sings" });
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

describe("the sent state", () => {
  it("starts a cooldown so a second link cannot be asked for immediately", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("grace@example.com"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    expect(result.current.emailSent).toBe(true);
    expect(result.current.resendIn).toBe(60);
  });

  it("ignores a resend while the cooldown is running", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("grace@example.com"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });
    updateUser.mockClear();

    await act(async () => {
      await result.current.resendVerification();
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("counts the cooldown down and then sends again", async () => {
    vi.useFakeTimers();
    try {
      updateUser.mockResolvedValue({ error: null });
      stubFetch();
      const { result } = renderHook(() => useAccountSettings());

      act(() => result.current.setNewEmail("grace@example.com"));
      await act(async () => {
        await result.current.changeEmail(submitEvent);
      });

      // Each second is scheduled by the render the previous one caused, so the
      // clock has to be walked forward a tick at a time rather than in one jump.
      for (let i = 0; i < 60; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      expect(result.current.resendIn).toBe(0);

      updateUser.mockClear();
      await act(async () => {
        await result.current.resendVerification();
      });

      expect(updateUser).toHaveBeenCalledWith({ email: "grace@example.com" });
      expect(result.current.toast?.title).toBe("Link sent again");
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes back to the form with the address still in it, so a typo is one edit away", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("grace@gmial.com"));
    await act(async () => {
      await result.current.changeEmail(submitEvent);
    });

    act(() => result.current.useDifferentEmail());

    expect(result.current.emailSent).toBe(false);
    expect(result.current.newEmail).toBe("grace@gmial.com");
    expect(result.current.resendIn).toBe(0);
  });
});

describe("changing the password", () => {
  it("refuses a weak one before asking the provider, naming the rule", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewPassword("short"));
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.newPasswordError).toBe("At least 12 characters");
    expect(result.current.toast).toBeNull();
  });

  // Long enough to pass a length rule on its own, which is the point of screening.
  it("refuses a decorated common password", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewPassword("password1234"));
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.newPasswordError).toBe("Not built on a commonly used password");
  });

  it("refuses one built from the account's own name", async () => {
    sessionValue.mockReturnValue({
      user: { ...speaker, full_name: "Ada Lovelace", email: "ada.lovelace@example.com" },
      updateUser: sessionUpdateUser,
    });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewPassword("adalovelace2026"));
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.newPasswordError).toBe("Not mostly your name or email address");
  });

  it("passes a strong one through and clears the fields", async () => {
    updateUser.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword("the quiet kettle sings");
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ password: "the quiet kettle sings" });
    expect(result.current.newPassword).toBe("");
    expect(result.current.toast?.title).toBe("Password updated");
  });
});

describe("proving the current password", () => {
  const STRONG = "the quiet kettle sings";

  it("refuses the change when the current password is wrong, and writes nothing", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("not-my-password");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.currentPasswordError).toBe("That is not your current password.");
    expect(result.current.newPasswordError).toBeNull();
    expect(result.current.toast).toBeNull();
  });

  it("leaves both fields filled after a refusal, so nothing has to be retyped", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("not-my-password");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(result.current.currentPassword).toBe("not-my-password");
    expect(result.current.newPassword).toBe(STRONG);
    expect(result.current.savingPassword).toBe(false);
  });

  it("checks the password against the signed-in account", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(verifyPassword).toHaveBeenCalledWith(speaker.email, "old-pass");
    expect(updateUser).toHaveBeenCalledWith({ password: STRONG });
  });

  // The local rules cost nothing; the proof costs a round trip.
  it("does not spend a round trip proving identity for a password that fails the rules", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword("short");
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(verifyPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses rather than checking when there is no signed-in email to check against", async () => {
    sessionValue.mockReturnValue({ user: { ...speaker, email: null }, updateUser: sessionUpdateUser });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(verifyPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.currentPasswordError).toBe("That is not your current password.");
  });

  it("clears the message as soon as the field is edited, so it never outlives the input it describes", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("not-my-password");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });
    expect(result.current.currentPasswordError).toBe("That is not your current password.");

    act(() => result.current.setCurrentPassword("not-my-passwordX"));

    expect(result.current.currentPasswordError).toBeNull();
  });

  it("puts a provider rejection on the new password field rather than in a toast", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(result.current.newPasswordError).toBe("New password should be different from the old password.");
    expect(result.current.currentPasswordError).toBeNull();
    expect(result.current.toast).toBeNull();
  });

  it("drops a stale message when the form is submitted again", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("not-my-password");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });
    expect(result.current.currentPasswordError).not.toBeNull();

    verifyPassword.mockResolvedValue(true);
    updateUser.mockResolvedValue({ error: null });
    await act(async () => {
      await result.current.changePassword(submitEvent);
    });

    expect(result.current.currentPasswordError).toBeNull();
    expect(result.current.toast?.title).toBe("Password updated");
  });
});
