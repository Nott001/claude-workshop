// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, act, waitFor } from "@testing-library/react";

const sessionValue = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => sessionValue(),
}));

const sessionUpdateUser = vi.fn();

const { verifyPassword } = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
vi.mock("@/modules/auth/lib/verify-password", () => ({ verifyPassword }));

const updateUser = vi.fn();
const getUser = vi.fn();
vi.mock("@/shared/db/browser-client", () => ({
  getBrowserClient: () => ({ auth: { updateUser, getUser } }),
}));

import { useAccountSettings, type SpeakerFieldKey } from "@/modules/user/lib/use-account-settings";

// The default session is an attendee, so the speaker profile fetch does not
// fire in the general cases; speaker-only cases opt in with speakerUser.
const user = { id: 1, role: ROLES.ATTENDEE, full_name: "Ada", email: "ada@example.com", profile_image_url: null };
const speakerUser = { ...user, role: ROLES.SPEAKER };

type Settings = ReturnType<typeof useAccountSettings>;

/**
 * The four speaker links live in one table now rather than four state pairs,
 * so a test reaches one by the key it is stored under.
 */
function speakerLink(settings: Settings, key: SpeakerFieldKey) {
  const field = settings.speaker.links.find((l) => l.key === key);
  if (!field) throw new Error(`no speaker link named ${key}`);
  return field;
}

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function stubFetch() {
  const fn = vi.fn<FetchFn>(() => Promise.resolve({ ok: true, json: async () => ({}) } as Response));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function response(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

const SEND_ROUTE = "/api/auth/email/send";
const CANCEL_ROUTE = "/api/auth/email/cancel";

// Answers an app route with the given JSON while keeping the default empty
// response for everything else, so tests exercise the request shape without a
// global mockImplementation for every call the hook makes.
function respondTo(route: string, body: unknown, ok = true) {
  const fetch = stubFetch();
  fetch.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes(route)) {
      return Promise.resolve({ ok, json: async () => body } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
  return fetch;
}

const submitEvent = { preventDefault: () => {} } as React.FormEvent;

beforeEach(() => {
  vi.clearAllMocks();
  verifyPassword.mockResolvedValue(true);
  sessionValue.mockReturnValue({ user, updateUser: sessionUpdateUser });
  // The restore effect reads GoTrue on mount; a resolved no-pending record is
  // the resting state every other describe asserts on.
  getUser.mockResolvedValue({ data: { user: null } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saving the profile name", () => {
  it("saves the name via PATCH /api/auth/me and confirms in the form", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("New Name"));
    await act(async () => {
      await result.current.profile.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "New Name" });
    expect(result.current.profile.saved).toBe(true);
    expect(result.current.toast).toBeNull();
  });

  it("pushes the saved name into the session so the navbar follows", async () => {
    stubFetch().mockImplementation(() => response({ ...user, full_name: "Grace Hopper" }));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Grace Hopper"));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(sessionUpdateUser).toHaveBeenCalledWith({ full_name: "Grace Hopper" });
  });

  it("sends a trimmed name and keeps the field on what was stored", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("  Grace Hopper  "));
    await act(async () => {
      await result.current.profile.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Grace Hopper" });
    expect(result.current.profile.name).toBe("Grace Hopper");
  });

  it("leaves the session alone when the save fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "boom" }, false));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Grace Hopper"));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
  });

  it("toasts an error when saving the name fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "boom" }, false));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Grace Hopper"));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(result.current.toast).toMatchObject({ title: "Error", description: "Failed to update profile.", type: "error" });
    expect(result.current.savedSection).toBeNull();
  });
});

describe("changing the email", () => {
  it("posts the address to the send route and reports sent, without writing the address anywhere", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(fetch).toHaveBeenCalledWith(SEND_ROUTE, expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetch.mock.calls.find((c) => String(c[0]).includes(SEND_ROUTE))![1]!.body))).toEqual({
      email: "new@example.com",
    });
    expect(result.current.email.sent).toBe(true);
    // The row is only caught up once the link is opened, by the callback route.
    expect(fetch.mock.calls.find((c) => c[1]?.method === "PATCH")).toBeUndefined();
  });

  it("keeps showing the address the account actually owns while a change is pending", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.currentUser?.email).toBe(user.email);
    expect(sessionUpdateUser).not.toHaveBeenCalledWith(expect.objectContaining({ email: expect.anything() }));
  });

  it("does not treat the address already on the account as a change", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue(user.email));
    await act(async () => {
      await result.current.email.save();
    });

    expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(false);
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(result.current.email.sent).toBe(false);
    expect(result.current.email.error).toBeNull();
  });

  it("also quits being a change however it is capitalised or padded", async () => {
    const { result } = renderHook(() => useAccountSettings());

    for (const typed of ["ADA@EXAMPLE.COM", "  Ada@Example.com  "]) {
      act(() => result.current.email.setValue(typed));
      await act(async () => {
        await result.current.email.save();
      });

      expect(result.current.email.error).toBeNull();
      expect(result.current.email.sent).toBe(false);
    }
  });

  it("sends a trimmed address so stray space cannot pass as a different one", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("  grace@example.com  "));
    await act(async () => {
      await result.current.email.save();
    });

    expect(JSON.parse(String(fetch.mock.calls.find((c) => String(c[0]).includes(SEND_ROUTE))![1]!.body))).toEqual({
      email: "grace@example.com",
    });
  });

  // How the address looks is the only gate now: there is no DNS lookup, so a
  // mistyped-but-well-formed domain is not refused. Tagged aliases and
  // sub-domains are legitimate mailboxes, and the verification link is the real
  // proof one works.
  it("sends to a well-formed domain without a mail check", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("ada@gmial.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.sent).toBe(true);
    expect(result.current.email.error).toBeNull();
  });

  it("accepts an address on any well-formed looking domain", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("ada@nowhere-at-all.test"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.sent).toBe(true);
  });

  it("refuses an address whose domain does not look like one", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    for (const typed of ["ada@localhost", "ada@no-dot"]) {
      act(() => result.current.email.setValue(typed));
      await act(async () => {
        await result.current.email.save();
      });

      expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(false);
      expect(result.current.email.sent).toBe(false);
      expect(result.current.email.error).toBe("Enter a valid email address, like name@example.com.");
    }
  });

  it("accepts a tagged alias such as ada+events@example.com", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("ada+events@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.sent).toBe(true);
  });

  it("stops showing progress after refusing a malformed address", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("ada@localhost"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.saving).toBe(false);
  });

  it("toasts the route's refusal and skips the PATCH when the email update fails", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: false, error: { status: 422, message: "Email already in use" } }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({ title: "Error", description: "Email already in use", type: "error" });
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
  });

  it("names the wait instead of the raw {} when a 429 exhausts the send budget", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: false, error: { status: 429, message: "" } }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      title: "Error",
      description: "Too many attempts. Please wait, then try again.",
      type: "error",
    });
    // A failure must leave emailSent false so the field stays editable with the
    // typed address intact and Save Changes stays enabled after the window.
    expect(result.current.email.sent).toBe(false);
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
  });

  it("counts down the wait the route reported instead of offering a doomed resend", async () => {
    respondTo(SEND_ROUTE, { ok: false, error: { status: 429, message: "", retryAfter: 43 } }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({ description: "Too many attempts. Try again in 43 seconds." });
    expect(result.current.email.resendIn).toBe(43);
  });

  // GoTrue's own limit sits behind the route's cooldown and states its wait in
  // prose. Reading it is what keeps a refusal with a known countdown from
  // arriving as an open-ended "please wait".
  it("counts down a wait GoTrue only spelled into its message", async () => {
    respondTo(
      SEND_ROUTE,
      {
        ok: false,
        error: {
          status: 429,
          code: "over_email_send_rate_limit",
          message: "For security purposes, you can only request this after 41 seconds.",
        },
      },
      false,
    );
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({ description: "Too many attempts. Try again in 41 seconds." });
    expect(result.current.email.resendIn).toBe(41);
  });

  // An hourly refusal names no wait, so there is nothing honest to count down
  // and the button stays live. Saying which limit was hit is the whole point:
  // the generic copy reads as a short cooldown that waiting a minute clears.
  it("names the hourly budget and leaves the resend live when no wait was given", async () => {
    respondTo(
      SEND_ROUTE,
      { ok: false, error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" } },
      false,
    );
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      description:
        "The app has reached its hourly limit for sending emails, which every account shares. Please try again later.",
    });
    expect(result.current.email.resendIn).toBe(0);
  });

  // Neither the object shape nor the bare-string convention: a body that
  // carries no usable error at all must still reach the caller's fallback
  // rather than rendering as nothing.
  it("falls back when the refusal carries no readable error", async () => {
    respondTo(SEND_ROUTE, { ok: false, error: 42 }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      description: "We could not send the verification link. Please try again.",
    });
  });

  it("maps the bare 401 error convention the auth routes use", async () => {
    respondTo(SEND_ROUTE, { error: "Unauthenticated" }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      title: "Error",
      description: "Unauthenticated",
      type: "error",
    });
    expect(result.current.email.sent).toBe(false);
  });

  it("uses the email fallback when a {} error carries no status", async () => {
    respondTo(SEND_ROUTE, { ok: false, error: { message: "{}" } }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      title: "Error",
      description: "We could not send the verification link. Please try again.",
      type: "error",
    });
    expect(result.current.email.sent).toBe(false);
  });

  it("shows the same-address refusal copy the route returns and keeps the sent box down", async () => {
    respondTo(SEND_ROUTE, { ok: false, error: { status: 400, message: "This is already your email address." } }, false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("other@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      title: "Error",
      description: "This is already your email address.",
      type: "error",
    });
    expect(result.current.email.sent).toBe(false);
  });

  it("uses the email fallback when the route answers something that is not JSON", async () => {
    const fetch = stubFetch();
    fetch.mockReturnValue(
      Promise.resolve({ ok: true, json: () => Promise.reject(new Error("unparseable")) } as unknown as Response),
    );
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("new@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.toast).toMatchObject({
      title: "Error",
      description: "We could not send the verification link. Please try again.",
      type: "error",
    });
    expect(result.current.email.sent).toBe(false);
  });
});

describe("the prefilled email field", () => {
  it("mounts with the session address in the field and saveChanges disabled", () => {
    const { result } = renderHook(() => useAccountSettings());

    expect(result.current.email.value).toBe(user.email);
    expect(result.current.email.dirty).toBe(false);
  });

  it("counts a genuinely different address as a change and sends it", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());
    expect(result.current.email.dirty).toBe(false);

    act(() => result.current.email.setValue("grace@example.com"));

    expect(result.current.email.dirty).toBe(true);
    await act(async () => {
      await result.current.email.save();
    });

    expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(true);
  });

  it("stops being a change again when the field is returned to the session address", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("GRACE@EXAMPLE.COM"));
    expect(result.current.email.dirty).toBe(true);

    act(() => result.current.email.setValue("  ada@example.com  "));
    expect(result.current.email.dirty).toBe(false);

    await act(async () => {
      await result.current.email.save();
    });

    expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(false);
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
  });

  it("leaves an emptied field clean and writes nothing", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    expect(result.current.email.dirty).toBe(true);

    act(() => result.current.email.setValue(""));
    expect(result.current.email.dirty).toBe(false);

    await act(async () => {
      await result.current.email.save();
    });

    expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(false);
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
    expect(result.current.email.error).toBeNull();
  });
});

describe("restoring an in-flight email change", () => {
  it("resumes the sent state for a pending change GoTrue still holds", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 1,
          new_email: "grace@example.com",
          email_change_sent_at: new Date(Date.now() - 10_000).toISOString(),
        },
      },
    });
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(result.current.email.sent).toBe(true));
    expect(result.current.email.value).toBe("grace@example.com");
    expect(result.current.email.resendIn).toBe(50);
  });

  it("restores the sent state with the cooldown spent once the window elapsed", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 1,
          new_email: "grace@example.com",
          email_change_sent_at: new Date(Date.now() - 70_000).toISOString(),
        },
      },
    });
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(result.current.email.sent).toBe(true));
    expect(result.current.email.value).toBe("grace@example.com");
    expect(result.current.email.resendIn).toBe(0);
  });

  // The send time is optional on the GoTrue user. Reading a missing one as
  // "just sent" re-armed the whole cooldown on every mount, and only a cancel
  // clears the pending record it keys on — so a reload always beat the
  // countdown and the resend stayed locked however long the user had waited.
  it("offers the resend straight away when the pending change has no recorded send time", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 1, new_email: "grace@example.com" } },
    });
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(result.current.email.sent).toBe(true));
    expect(result.current.email.resendIn).toBe(0);
  });

  it("offers the resend straight away when the recorded send time cannot be parsed", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 1, new_email: "grace@example.com", email_change_sent_at: "not-a-date" } },
    });
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(result.current.email.sent).toBe(true));
    expect(result.current.email.resendIn).toBe(0);
  });

  it("leaves the form untouched when GoTrue reports no pending change", async () => {
    getUser.mockResolvedValue({ data: { user: { id: 1, email: user.email } } });
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(getUser).toHaveBeenCalled());
    expect(result.current.email.sent).toBe(false);
    expect(result.current.email.value).toBe(user.email);
  });

  it("ignores a pending change that only re-states the address the account owns", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 1, new_email: "  ADA@example.com  " } },
    });
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(getUser).toHaveBeenCalled());
    expect(result.current.email.sent).toBe(false);
    expect(result.current.email.value).toBe(user.email);
  });

  it("waits for the session to resolve before restoring", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 1,
          new_email: "grace@example.com",
          email_change_sent_at: new Date(Date.now() - 10_000).toISOString(),
        },
      },
    });
    sessionValue.mockReturnValue({ user: { ...user, email: "" }, updateUser: sessionUpdateUser });
    const { result, rerender } = renderHook(() => useAccountSettings());

    await act(async () => {});
    expect(result.current.email.sent).toBe(false);
    expect(getUser).not.toHaveBeenCalled();

    sessionValue.mockReturnValue({ user, updateUser: sessionUpdateUser });
    await act(async () => {
      rerender();
    });
    expect(result.current.email.sent).toBe(true);
    expect(result.current.email.value).toBe("grace@example.com");
  });

  it("does not clobber a value typed since the restore, but adopts a genuinely new pending address", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 1,
          new_email: "grace@example.com",
          email_change_sent_at: new Date(Date.now() - 10_000).toISOString(),
        },
      },
    });
    const { result, rerender } = renderHook(() => useAccountSettings());
    await waitFor(() => expect(result.current.email.sent).toBe(true));

    act(() => result.current.email.setValue("ada@typed.io"));
    expect(result.current.email.value).toBe("ada@typed.io");

    await act(async () => {
      rerender();
    });
    expect(result.current.email.value).toBe("ada@typed.io");

    getUser.mockResolvedValue({
      data: { user: { id: 1, new_email: "second@example.com", email_change_sent_at: null } },
    });
    await act(async () => {
      rerender();
    });
    await waitFor(() => expect(result.current.email.value).toBe("second@example.com"));
    expect(result.current.email.sent).toBe(true);
  });
});

describe("when the pending email change is confirmed", () => {
  it("clears the banner the moment the session reaches the address that was asked for", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result, rerender } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });
    expect(result.current.email.sent).toBe(true);

    // The confirmation link was opened in another tab, so auth-js re-broadcast
    // puts the new address on the session — the pending banner must not survive
    // it, and the section records the address so it can say "verified".
    sessionValue.mockReturnValue({ user: { ...user, email: "grace@example.com" }, updateUser: sessionUpdateUser });
    await act(async () => {
      rerender();
    });

    expect(result.current.email.sent).toBe(false);
    expect(result.current.email.resendIn).toBe(0);
    expect(result.current.email.value).toBe("grace@example.com");
    expect(result.current.email.verified).toBe("grace@example.com");
  });

  it("leaves the banner alone for a session repaint that is not the confirmation", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result, rerender } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });
    expect(result.current.email.sent).toBe(true);

    // A profile save re-emits the session under the old address; the change is
    // still in flight, so the banner stays until the session actually reaches
    // the pending address, and nothing has been verified.
    sessionValue.mockReturnValue({ user: { ...user, full_name: "Grace Hopper" }, updateUser: sessionUpdateUser });
    await act(async () => {
      rerender();
    });

    expect(result.current.email.sent).toBe(true);
    expect(result.current.email.value).toBe("grace@example.com");
    expect(result.current.email.verified).toBeNull();
  });

  it("clears the verified notice when dismissed", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result, rerender } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });
    sessionValue.mockReturnValue({ user: { ...user, email: "grace@example.com" }, updateUser: sessionUpdateUser });
    await act(async () => {
      rerender();
    });
    expect(result.current.email.verified).toBe("grace@example.com");

    act(() => result.current.email.dismissVerified());

    expect(result.current.email.verified).toBeNull();
  });
});

describe("the speaker profile inside the unified hook", () => {
  const speakerData = {
    speaker_profile_id: 5,
    designation: "CTO",
    bio: "Leads the team.",
    linkedin_url: "https://linkedin.com/in/ada",
    twitter_url: null,
    github_url: "https://github.com/ada",
    website_url: "https://ada.dev",
  };

  function useAsSpeaker() {
    sessionValue.mockReturnValue({ user: speakerUser, updateUser: sessionUpdateUser });
  }

  it("loads the speaker fields from /api/auth/me when the user is a speaker", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(result.current.speaker.loading).toBe(false));
    expect(fetch).toHaveBeenCalledWith("/api/auth/me");
    expect(result.current.speaker.isSpeaker).toBe(true);
    expect(result.current.speaker.designation).toBe("CTO");
    expect(result.current.speaker.bio).toBe("Leads the team.");
    expect(speakerLink(result.current, "linkedin").value).toBe("https://linkedin.com/in/ada");
    expect(speakerLink(result.current, "twitter").value).toBe("");
    expect(speakerLink(result.current, "github").value).toBe("https://github.com/ada");
    expect(speakerLink(result.current, "website").value).toBe("https://ada.dev");
  });

  it("does nothing for any non-speaker role", () => {
    const fetch = stubFetch();

    // Facilitators and admins outrank speakers, but the speaker profile section
    // belongs to the speaker row alone, so min-role must not admit them.
    for (const role of [ROLES.ATTENDEE, ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      sessionValue.mockReturnValue({ user: { ...user, role }, updateUser: sessionUpdateUser });
      const { result } = renderHook(() => useAccountSettings());

      expect(result.current.speaker.isSpeaker).toBe(false);
      expect(result.current.speaker.loading).toBe(true);

      cleanup();
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not seed fields from a speaker fetch that resolves after unmount", async () => {
    useAsSpeaker();
    let resolve: (v: Response | PromiseLike<Response>) => void = () => {};
    const fetch = stubFetch();
    fetch.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useAccountSettings());

    unmount();
    resolve(response(speakerData));
    await act(async () => {});

    expect(result.current.speaker.loading).toBe(true);
    expect(result.current.speaker.designation).toBe("");
  });

  it("waits for the speaker fetch before the seeded values count as clean", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());

    // Before the fetch answers, the empty seeds would look dirty against empty
    // saved originals; only after both land together is the group clean.
    expect(result.current.speaker.dirty).toBe(false);
    await waitFor(() => expect(result.current.speaker.loading).toBe(false));
    expect(result.current.speaker.dirty).toBe(false);
  });

  // A speaker with no profile row yet: /api/auth/me can omit the speaker block
  // entirely, and the seeds have to land at empty rather than stay dirty.
  it("seeds empty speaker fields when the profile fetch omits them", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response({}));
    const { result } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(result.current.speaker.loading).toBe(false));
    expect(result.current.speaker.designation).toBe("");
    expect(result.current.speaker.bio).toBe("");
    expect(speakerLink(result.current, "linkedin").value).toBe("");
    expect(speakerLink(result.current, "twitter").value).toBe("");
    expect(speakerLink(result.current, "github").value).toBe("");
    expect(speakerLink(result.current, "website").value).toBe("");
    expect(result.current.speaker.dirty).toBe(false);
  });
});

describe("each card saving on its own", () => {
  const STRONG = "the quiet kettle sings";

  it("sends only the columns the profile card owns", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Ada Lovelace"));
    await act(async () => {
      await result.current.profile.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Ada Lovelace" });
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(1);
    expect(updateUser).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  // The whole point of the split: one card's button cannot reach another
  // card's fields, so a name save can never spend a mail or touch a password.
  it("leaves the other cards alone when one saves", async () => {
    updateUser.mockResolvedValue({ error: null });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.profile.setName("Grace Hopper");
      result.current.email.setValue("grace@example.com");
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.profile.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Grace Hopper" });
    expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.password.next).toBe(STRONG);
  });

  it("flags an emptied name and aborts before any request", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("  "));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(result.current.profile.nameError).toBe("Name is required.");
    expect(fetch).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("treats the account's own prefilled address as no change, so the card is not dirty", () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue(user.email));

    expect(result.current.email.dirty).toBe(false);
  });

  it("refuses a malformed address inline and writes nothing", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("ada@localhost"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.error).toBe("Enter a valid email address, like name@example.com.");
    expect(fetch.mock.calls.some((c) => String(c[0]).includes(SEND_ROUTE))).toBe(false);
  });

  it("changes the password from its own card and clears the fields", async () => {
    updateUser.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).toHaveBeenCalledWith({ password: STRONG });
    expect(result.current.password.current).toBe("");
    expect(result.current.password.next).toBe("");
  });

  // The submit button's `disabled` is a DOM attribute, and a browser extension
  // stripping it is what a hydration mismatch on this page turned out to be. It
  // cannot be the only thing holding a second submission off.
  it("ignores a second submit while the first is still verifying the password", async () => {
    updateUser.mockResolvedValue({ error: null });
    // Held open on purpose: this is the window a `saving` state flag misses,
    // since the flag does not paint until after this call resolves.
    let releaseVerify: (ok: boolean) => void = () => {};
    verifyPassword.mockImplementation(() => new Promise<boolean>((resolve) => (releaseVerify = resolve)));
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });

    await act(async () => {
      const first = result.current.password.save();
      const second = result.current.password.save();
      releaseVerify(true);
      await Promise.all([first, second]);
    });

    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  // One guard across every card, so two sections cannot race the same session.
  it("holds a second card's save off while one is already running", async () => {
    updateUser.mockResolvedValue({ error: null });
    const fetch = stubFetch();
    let releaseVerify: (ok: boolean) => void = () => {};
    verifyPassword.mockImplementation(() => new Promise<boolean>((resolve) => (releaseVerify = resolve)));
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.profile.setName("Grace Hopper");
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });

    await act(async () => {
      const password = result.current.password.save();
      const profile = result.current.profile.save();
      releaseVerify(true);
      await Promise.all([password, profile]);
    });

    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
  });

  it("accepts a fresh submit after a validation failure releases the guard", async () => {
    updateUser.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAccountSettings());

    // A weak new password fails before any write, on the path that returns
    // early rather than through the try/finally.
    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext("short");
    });
    await act(async () => {
      await result.current.password.save();
    });
    expect(updateUser).not.toHaveBeenCalled();

    act(() => result.current.password.setNext(STRONG));
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).toHaveBeenCalledWith({ password: STRONG });
  });

  it("flips a card's dirty flag back once its own save lands", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation(() => response({ ...user, full_name: "Ada Lovelace" }));
    const { result, rerender } = renderHook(() => useAccountSettings());
    expect(result.current.profile.dirty).toBe(false);

    act(() => result.current.profile.setName("Ada Lovelace"));
    rerender();
    expect(result.current.profile.dirty).toBe(true);

    await act(async () => {
      await result.current.profile.save();
    });
    rerender();
    expect(result.current.profile.dirty).toBe(false);
  });

  it("keeps an untouched password card from counting as dirty", () => {
    const { result } = renderHook(() => useAccountSettings());
    expect(result.current.password.dirty).toBe(false);

    act(() => result.current.profile.setName("Ada Lovelace"));

    expect(result.current.password.dirty).toBe(false);
    expect(result.current.profile.dirty).toBe(true);
  });
});

describe("the per-card save confirmation", () => {
  it("confirms nothing for an email save, which says so in the card instead", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.sent).toBe(true);
    expect(result.current.savedSection).toBeNull();
  });

  // A confirmation belongs to the card that earned it and to no other, which
  // the single notice could not express.
  it("confirms only on the card that saved", async () => {
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Ada Lovelace"));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(result.current.profile.saved).toBe(true);
    expect(result.current.password.saved).toBe(false);
    expect(result.current.speaker.saved).toBe(false);
  });

  it("clears a live confirmation when the field behind it is edited", async () => {
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Ada Lovelace"));
    await act(async () => {
      await result.current.profile.save();
    });
    expect(result.current.profile.saved).toBe(true);

    act(() => result.current.profile.setName("Ada"));

    expect(result.current.profile.saved).toBe(false);
  });

  it("clears a live confirmation when a speaker field is edited", async () => {
    const speaker = { speaker_profile_id: 5, designation: "CTO", bio: "Leads.", linkedin_url: "https://linkedin.com/in/ada" };
    sessionValue.mockReturnValue({ user: speakerUser, updateUser: sessionUpdateUser });
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speaker));
    const { result } = renderHook(() => useAccountSettings());
    await waitFor(() => expect(result.current.speaker.loading).toBe(false));

    act(() => speakerLink(result.current, "linkedin").onChange("https://linkedin.com/in/grace"));
    await act(async () => {
      await result.current.speaker.save();
    });
    expect(result.current.speaker.saved).toBe(true);

    act(() => result.current.speaker.setBio("Fresh bio."));

    expect(result.current.speaker.saved).toBe(false);
  });

  it("drops the confirmation at the start of the next attempt, before validation", async () => {
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Ada Lovelace"));
    await act(async () => {
      await result.current.profile.save();
    });
    expect(result.current.profile.saved).toBe(true);

    // A new attempt that dies in validation must not leave the old
    // confirmation on screen as if the last save were the one that landed.
    act(() => result.current.profile.setName(""));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(result.current.profile.nameError).toBe("Name is required.");
    expect(result.current.profile.saved).toBe(false);
  });

  it("never confirms when the profile PATCH fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "boom" }, false));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.profile.setName("Ada Lovelace"));
    await act(async () => {
      await result.current.profile.save();
    });

    expect(result.current.profile.saved).toBe(false);
    expect(result.current.toast).toMatchObject({ title: "Error", description: "Failed to update profile.", type: "error" });
  });
});

describe("speaker PATCH through saveChanges", () => {
  const speakerData = {
    speaker_profile_id: 5,
    designation: "CTO",
    bio: "Leads.",
    linkedin_url: "https://linkedin.com/in/ada",
    twitter_url: null,
    github_url: "https://github.com/ada",
    website_url: "https://ada.dev",
  };

  function useAsSpeaker() {
    sessionValue.mockReturnValue({ user: speakerUser, updateUser: sessionUpdateUser });
  }

  async function loadSpeaker(result: { current: ReturnType<typeof useAccountSettings> }) {
    await waitFor(() => expect(result.current.speaker.loading).toBe(false));
  }

  it("sends only the dirty speaker fields in the shared PATCH", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => result.current.speaker.setDesignation("CTO Emeritus"));
    act(() => speakerLink(result.current, "github").onChange("https://github.com/ada-lovelace"));
    await act(async () => {
      await result.current.speaker.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      designation: "CTO Emeritus",
      bio: "Leads.",
      linkedin_url: "https://linkedin.com/in/ada",
      twitter_url: null,
      github_url: "https://github.com/ada-lovelace",
      website_url: "https://ada.dev",
    });
  });

  it("coerces emptied speaker links to null", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => speakerLink(result.current, "linkedin").onChange(""));
    act(() => speakerLink(result.current, "website").onChange(""));
    await act(async () => {
      await result.current.speaker.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      designation: "CTO",
      bio: "Leads.",
      linkedin_url: null,
      twitter_url: null,
      github_url: "https://github.com/ada",
      website_url: null,
    });
  });

  it("coerces an emptied free-text block to null while a fresh link survives", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => result.current.speaker.setDesignation(""));
    act(() => result.current.speaker.setBio(""));
    act(() => speakerLink(result.current, "github").onChange(""));
    act(() => speakerLink(result.current, "twitter").onChange("https://twitter.com/ada_lovelace"));
    await act(async () => {
      await result.current.speaker.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      designation: null,
      bio: null,
      linkedin_url: "https://linkedin.com/in/ada",
      twitter_url: "https://twitter.com/ada_lovelace",
      github_url: null,
      website_url: "https://ada.dev",
    });
  });

  it("flags an invalid URL on the owning field and aborts the whole batch", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => speakerLink(result.current, "github").onChange("not a url"));
    await act(async () => {
      await result.current.speaker.save();
    });

    expect(result.current.speaker.errors).toEqual({ github: "Enter a valid full URL (https://…)." });
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  // The two cards share the /api/auth/me route but not a submit, so a link the
  // speaker card would refuse cannot hold up a rename — and the rename sends
  // only its own column rather than blanking the speaker's.
  it("saves a name while a speaker link is invalid, sending only the name", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response({ ...speakerData, full_name: "Grace Hopper" }));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => {
      speakerLink(result.current, "github").onChange("not-a-url");
      result.current.profile.setName("Grace Hopper");
    });
    await act(async () => {
      await result.current.profile.save();
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Grace Hopper" });
    expect(result.current.profile.saved).toBe(true);
  });

  it("confirms nothing and says so when the speaker PATCH fails", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    fetch.mockImplementation(() => response({ error: "boom" }, false));
    act(() => result.current.speaker.setDesignation("Principal"));
    await act(async () => {
      await result.current.speaker.save();
    });

    expect(result.current.speaker.saved).toBe(false);
    // The baseline must not move, or the card would go clean on a write that
    // never landed and the change would vanish on the next render.
    expect(result.current.speaker.dirty).toBe(true);
    expect(result.current.toast).toMatchObject({ title: "Error", description: "Failed to update profile." });
  });

  it("sends no PATCH when a speaker has nothing to save", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    await act(async () => {
      await result.current.speaker.save();
    });

    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
    expect(result.current.speaker.dirty).toBe(false);
  });

  it("clears the field error when the offending link is edited again", async () => {
    useAsSpeaker();
    stubFetch().mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => speakerLink(result.current, "github").onChange("not a url"));
    await act(async () => {
      await result.current.speaker.save();
    });
    expect(result.current.speaker.errors?.github).toBeTruthy();

    act(() => speakerLink(result.current, "github").onChange("https://github.com/ada"));

    expect(result.current.speaker.errors?.github).toBeUndefined();
  });

  it("flips speakerDirty back to clean once saved", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result, rerender } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);
    expect(result.current.speaker.dirty).toBe(false);

    act(() => result.current.speaker.setBio("Fresh bio."));
    rerender();
    expect(result.current.speaker.dirty).toBe(true);

    await act(async () => {
      await result.current.speaker.save();
    });
    rerender();
    expect(result.current.speaker.dirty).toBe(false);
  });
});

describe("the sent state", () => {
  it("starts a cooldown so a second link cannot be asked for immediately", async () => {
    respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    expect(result.current.email.sent).toBe(true);
    expect(result.current.email.resendIn).toBe(60);
  });

  it("ignores a resend while the cooldown is running", async () => {
    const fetch = respondTo(SEND_ROUTE, { ok: true });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });

    await act(async () => {
      await result.current.email.resend();
    });

    expect(fetch.mock.calls.filter((c) => String(c[0]).includes(SEND_ROUTE))).toHaveLength(1);
  });

  it("does not claim a resend the provider refused", async () => {
    vi.useFakeTimers();
    try {
      respondTo(SEND_ROUTE, { ok: true });
      const { result } = renderHook(() => useAccountSettings());

      act(() => result.current.email.setValue("grace@example.com"));
      await act(async () => {
        await result.current.email.save();
      });
      // Walk the countdown down (one tick per scheduled second) so the resend is
      // actually allowed to fire.
      for (let i = 0; i < 60; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      expect(result.current.email.resendIn).toBe(0);

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({ ok: false, json: async () => ({ ok: false, error: { message: "Email already in use" } }) }),
        ),
      );
      await act(async () => {
        await result.current.email.resend();
      });

      expect(result.current.toast?.title).toBe("Error");
      expect(result.current.email.sent).toBe(true);
      // A refused send must not start a fresh countdown, or the wait it
      // advertises would be a lie.
      expect(result.current.email.resendIn).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("counts the cooldown down and then sends again", async () => {
    vi.useFakeTimers();
    try {
      respondTo(SEND_ROUTE, { ok: true });
      const { result } = renderHook(() => useAccountSettings());

      act(() => result.current.email.setValue("grace@example.com"));
      await act(async () => {
        await result.current.email.save();
      });

      // Each second is scheduled by the render the previous one caused, so the
      // clock has to be walked forward a tick at a time rather than in one jump.
      for (let i = 0; i < 60; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      expect(result.current.email.resendIn).toBe(0);

      await act(async () => {
        await result.current.email.resend();
      });

      expect(result.current.toast?.title).toBe("Link sent again");
      expect(result.current.email.resendIn).toBe(60);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe("dismissing an email change", () => {
  // respondTo cannot drive these tests on its own: its default answer is a
  // bare `{}`, and a send that does not answer `ok` never reaches the pending
  // state. So the send route is answered ok here and the cancel route is
  // answered with whatever the test needs.
  function stubRoutes(cancel: { ok: boolean; error?: { status: number; message: string } }) {
    const fetch = stubFetch();
    fetch.mockImplementation((input: string | URL | Request) => {
      if (String(input).includes(SEND_ROUTE)) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response);
      }
      if (String(input).includes(CANCEL_ROUTE)) {
        return Promise.resolve({ ok: cancel.ok, json: async () => cancel } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
    return fetch;
  }

  async function getSentState() {
    const { result } = renderHook(() => useAccountSettings());
    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });
    return result;
  }

  it("cancels through the route, returning the field to the account email", async () => {
    const fetch = stubRoutes({ ok: true });
    const result = await getSentState();
    expect(result.current.email.sent).toBe(true);

    await act(async () => {
      await result.current.email.cancel();
    });

    expect(fetch.mock.calls.some((c) => String(c[0]).includes(CANCEL_ROUTE))).toBe(true);
    expect(result.current.email.sent).toBe(false);
    expect(result.current.email.resendIn).toBe(0);
    // The field is bound to the stored address, not the attempted one: cancel
    // snaps it back, so what is on screen is plainly the original email.
    expect(result.current.email.value).toBe("ada@example.com");
    expect(result.current.email.verified).toBeNull();
    expect(result.current.toast).toBeNull();
  });

  // The route voided the change, so a reload finds GoTrue holding nothing and
  // the restore effect leaves the banner down. The field re-seeds from the
  // session — a genuine reload has no record of the typed address once the
  // pending change is gone.
  it("keeps the banner down after a reload once the change was voided", async () => {
    stubRoutes({ ok: true });
    const { result: first, unmount } = renderHook(() => useAccountSettings());
    act(() => first.current.email.setValue("grace@example.com"));
    await act(async () => {
      await first.current.email.save();
    });
    expect(first.current.email.sent).toBe(true);

    await act(async () => {
      await first.current.email.cancel();
    });
    expect(first.current.email.sent).toBe(false);

    unmount();
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 1,
          // No new_email: the cancel cleared it server-side.
        },
      },
    });
    const { result: reloaded } = renderHook(() => useAccountSettings());

    await waitFor(() => expect(reloaded.current.email.sent).toBe(false));
    expect(reloaded.current.email.value).toBe("ada@example.com");
  });

  // A cancel that answers with something unparseable is a cancel that did not
  // happen, so the pending banner has to stay up rather than clearing on a
  // reply nobody could read.
  it("keeps the banner up when the cancel route answers unreadable JSON", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation((input: string | URL | Request) => {
      if (String(input).includes(CANCEL_ROUTE)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error("not json")),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response);
    });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.email.setValue("grace@example.com"));
    await act(async () => {
      await result.current.email.save();
    });
    expect(result.current.email.sent).toBe(true);

    await act(async () => {
      await result.current.email.cancel();
    });

    expect(result.current.email.sent).toBe(true);
    expect(result.current.toast).toMatchObject({
      title: "Error",
      description: "We could not cancel the pending change. Please try again.",
    });
  });

  it("keeps the banner and toasts when the cancel route fails", async () => {
    stubRoutes({ ok: false, error: { status: 500, message: "boom" } });
    const result = await getSentState();
    expect(result.current.email.sent).toBe(true);

    await act(async () => {
      await result.current.email.cancel();
    });

    expect(result.current.email.sent).toBe(true);
    expect(result.current.toast?.type).toBe("error");
  });
});

describe("changing the password", () => {
  it("refuses a weak one before asking the provider, naming the rule", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.password.setNext("short"));
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.password.nextError).toBe("At least 12 characters");
    expect(result.current.toast).toBeNull();
  });

  // Long enough to pass a length rule on its own, which is the point of screening.
  it("refuses a decorated common password", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.password.setNext("password1234"));
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.password.nextError).toBe("Not built on a commonly used password");
  });

  it("refuses one built from the account's own name", async () => {
    sessionValue.mockReturnValue({
      user: { ...user, full_name: "Ada Lovelace", email: "ada.lovelace@example.com" },
      updateUser: sessionUpdateUser,
    });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.password.setNext("adalovelace2026"));
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.password.nextError).toBe("Not mostly your name or email address");
  });

  it("passes a strong one through and clears the fields", async () => {
    updateUser.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext("the quiet kettle sings");
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).toHaveBeenCalledWith({ password: "the quiet kettle sings" });
    expect(result.current.password.next).toBe("");
    expect(result.current.password.saved).toBe(true);
  });
});

describe("proving the current password", () => {
  const STRONG = "the quiet kettle sings";

  it("refuses the change when the current password is wrong, and writes nothing", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("not-my-password");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.password.currentError).toBe("That is not your current password.");
    expect(result.current.password.nextError).toBeNull();
    expect(result.current.toast).toBeNull();
  });

  it("leaves both fields filled after a refusal, so nothing has to be retyped", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("not-my-password");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(result.current.password.current).toBe("not-my-password");
    expect(result.current.password.next).toBe(STRONG);
    expect(result.current.password.saving).toBe(false);
  });

  it("checks the password against the signed-in account", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(verifyPassword).toHaveBeenCalledWith(user.email, "old-pass");
    expect(updateUser).toHaveBeenCalledWith({ password: STRONG });
  });

  // The local rules cost nothing; the proof costs a round trip.
  it("does not spend a round trip proving identity for a password that fails the rules", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext("short");
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(verifyPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses rather than checking when there is no signed-in email to check against", async () => {
    sessionValue.mockReturnValue({ user: { ...user, email: null }, updateUser: sessionUpdateUser });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(verifyPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.password.currentError).toBe("That is not your current password.");
  });

  it("clears the message as soon as the field is edited, so it never outlives the input it describes", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("not-my-password");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });
    expect(result.current.password.currentError).toBe("That is not your current password.");

    act(() => result.current.password.setCurrent("not-my-passwordX"));

    expect(result.current.password.currentError).toBeNull();
  });

  it("puts a provider rejection on the new password field rather than in a toast", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(result.current.password.nextError).toBe("New password should be different from the old password.");
    expect(result.current.password.currentError).toBeNull();
    expect(result.current.toast).toBeNull();
  });

  it("names the password wait rather than the raw {} on a 429", async () => {
    updateUser.mockResolvedValue({ error: { status: 429, message: "{}" } });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("old-pass");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });

    expect(result.current.password.nextError).toBe("Too many attempts. Please wait, then try again.");
    // A refusal over the rate limit is not a verdict on the password itself,
    // so nothing the user typed should be discarded.
    expect(result.current.password.current).toBe("old-pass");
    expect(result.current.password.next).toBe(STRONG);
    expect(result.current.toast).toBeNull();
  });

  it("drops a stale message when the form is submitted again", async () => {
    verifyPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.password.setCurrent("not-my-password");
      result.current.password.setNext(STRONG);
    });
    await act(async () => {
      await result.current.password.save();
    });
    expect(result.current.password.currentError).not.toBeNull();

    verifyPassword.mockResolvedValue(true);
    updateUser.mockResolvedValue({ error: null });
    await act(async () => {
      await result.current.password.save();
    });

    expect(result.current.password.currentError).toBeNull();
    expect(result.current.password.saved).toBe(true);
  });
});

describe("profile photo", () => {
  it("ignores a change event that carries no file", async () => {
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.photo.change({ target: { files: [] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.photo.uploading).toBe(false);
  });

  it("uploads the photo and updates the session user's profile_image_url", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation((url: string | URL | Request) =>
      response(String(url).includes("/api/upload/profile-image") ? { url: "https://cdn.example/x.jpg" } : {}),
    );
    const { result } = renderHook(() => useAccountSettings());

    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.photo.change({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    const post = fetch.mock.calls.find((c) => String(c[0]).includes("/api/upload/profile-image"));
    expect(post).toBeTruthy();
    expect(post![1]!.body).toBeInstanceOf(FormData);
    expect(sessionUpdateUser).toHaveBeenCalledWith({ profile_image_url: "https://cdn.example/x.jpg" });
  });

  it("hands the uploaded URL back through the session so the settings preview updates", async () => {
    let current = user;
    sessionUpdateUser.mockImplementation((patch) => {
      current = { ...current, ...patch };
    });
    sessionValue.mockImplementation(() => ({ user: current, updateUser: sessionUpdateUser }));
    const fetch = stubFetch();
    fetch.mockImplementation((url: string | URL | Request) =>
      response(String(url).includes("/api/upload/profile-image") ? { url: "https://cdn.example/x.jpg" } : {}),
    );
    const { result, rerender } = renderHook(() => useAccountSettings());

    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    await act(async () => {
      await result.current.photo.change({
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
      await result.current.photo.change({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
    expect(result.current.toast?.type).toBe("error");
  });

  it("deletes the photo and nulls the session photo on success", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.photo.remove();
    });

    const del = fetch.mock.calls.find((c) => c[1]?.method === "DELETE");
    expect(del).toBeTruthy();
    expect(String(del![0])).toContain("/api/upload/profile-image");
    expect(sessionUpdateUser).toHaveBeenCalledWith({ profile_image_url: null });
    expect(result.current.toast?.type).toBe("success");
  });

  it("nulls the session photo so the preview and navbar avatar clear together", async () => {
    let current = { ...user, profile_image_url: "https://cdn.example/old.jpg" };
    sessionUpdateUser.mockImplementation((patch) => {
      current = { ...current, ...patch };
    });
    sessionValue.mockImplementation(() => ({ user: current, updateUser: sessionUpdateUser }));
    stubFetch();
    const { result, rerender } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.photo.remove();
    });

    rerender();
    expect(result.current.currentUser?.profile_image_url).toBeNull();
  });

  it("leaves the session photo alone and toasts an error when the delete fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "delete failed" }, false));
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.photo.remove();
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
    expect(result.current.toast).toEqual({
      id: expect.any(Number),
      title: "Delete failed",
      description: "Could not remove your profile photo.",
      type: "error",
    });
  });

  it("toasts the same error when the delete request itself rejects", async () => {
    stubFetch().mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.photo.remove();
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
    expect(result.current.toast).toEqual({
      id: expect.any(Number),
      title: "Delete failed",
      description: "Could not remove your profile photo.",
      type: "error",
    });
  });
});

describe("useAccountSettings toast lifecycle", () => {
  it("gives each message its own id so the rendered Toast is re-keyed", () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.notify({ title: "First", description: "one", type: "success" }));
    const first = result.current.toast!.id;

    act(() => result.current.notify({ title: "Second", description: "two", type: "success" }));

    expect(result.current.toast!.title).toBe("Second");
    // A shared id would let the second message inherit the first's dismissal
    // countdown, because Toast keeps that timer in state keyed on its identity.
    expect(result.current.toast!.id).not.toBe(first);
  });

  it("keeps dismissToast stable across renders", () => {
    const { result, rerender } = renderHook(() => useAccountSettings());
    const first = result.current.dismissToast;

    rerender();
    act(() => result.current.notify({ title: "Saved", description: "ok", type: "success" }));

    // Toast restarts its dismissal effect whenever onClose changes identity, so
    // a handler rebuilt each render leaves the message on screen indefinitely.
    expect(result.current.dismissToast).toBe(first);
  });

  it("clears the message on dismiss", () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.notify({ title: "Saved", description: "ok", type: "success" }));
    expect(result.current.toast).not.toBeNull();

    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });
});
