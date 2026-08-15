// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, act, waitFor } from "@testing-library/react";

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

// The default session is an attendee, so the speaker profile fetch does not
// fire in the general cases; speaker-only cases opt in with speakerUser.
const user = { id: 1, role: ROLES.ATTENDEE, full_name: "Ada", email: "ada@example.com", profile_image_url: null };
const speakerUser = { ...user, role: ROLES.SPEAKER };

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
  sessionValue.mockReturnValue({ user, updateUser: sessionUpdateUser });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saving the profile name", () => {
  it("saves the name via PATCH /api/auth/me and toasts success", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("New Name"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "New Name" });
    expect(result.current.toast).toMatchObject({
      title: "Profile updated",
      description: "Your profile has been saved.",
      type: "success",
    });
  });

  it("pushes the saved name into the session so the navbar follows", async () => {
    stubFetch().mockImplementation(() => response({ ...user, full_name: "Grace Hopper" }));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("Grace Hopper"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(sessionUpdateUser).toHaveBeenCalledWith({ full_name: "Grace Hopper" });
  });

  it("sends a trimmed name and keeps the field on what was stored", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("  Grace Hopper  "));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
    });

    expect(sessionUpdateUser).not.toHaveBeenCalled();
  });

  it("toasts an error when saving the name fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "boom" }, false));
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("Grace Hopper"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.toast).toMatchObject({ title: "Error", description: "Failed to update profile.", type: "error" });
  });
});

describe("changing the email", () => {
  it("asks supabase to send the link and reports sent, without writing the address anywhere", async () => {
    updateUser.mockResolvedValue({ error: null });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("new@example.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(result.current.emailSent).toBe(true);
    // The row is only caught up once the link is opened, by the callback route.
    expect(fetch.mock.calls.find((c) => c[1]?.method === "PATCH")).toBeUndefined();
  });

  it("keeps showing the address the account actually owns while a change is pending", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("new@example.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.currentUser?.email).toBe(user.email);
    expect(sessionUpdateUser).not.toHaveBeenCalledWith(expect.objectContaining({ email: expect.anything() }));
  });

  it("refuses the address already on the account without calling supabase or the API", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail(user.email));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(result.current.emailSent).toBe(false);
    expect(result.current.emailError).toBe("This is already your email address.");
  });

  it("refuses it however it is capitalised or padded", async () => {
    const { result } = renderHook(() => useAccountSettings());

    for (const typed of ["ADA@EXAMPLE.COM", "  Ada@Example.com  "]) {
      act(() => result.current.setNewEmail(typed));
      await act(async () => {
        await result.current.saveChanges(submitEvent);
      });

      expect(updateUser).not.toHaveBeenCalled();
    }
  });

  it("sends a trimmed address so stray space cannot pass as a different one", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("  grace@example.com  "));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ email: "grace@example.com" });
  });

  it("refuses a domain with no mail server and suggests the likely typo", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@gmial.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(result.current.emailSent).toBe(false);
    expect(result.current.emailError).toBe("We could not find a mail server for gmial.com. Did you mean ada@gmail.com?");
  });

  it("refuses an unrecognisable dead domain without inventing a suggestion", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@nowhere-at-all.test"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.emailError).toBe("We could not find a mail server for nowhere-at-all.test. Check the spelling.");
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
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ email: "ada@obscure.test" });
    expect(result.current.emailSent).toBe(true);
  });

  it("checks the domain only after the address is known to be a real change", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail(user.email));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(checkMailDomain).not.toHaveBeenCalled();
  });

  it("stops showing progress after refusing the domain", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@gmial.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.saving).toBe(false);
  });

  it("toasts the supabase error and skips the PATCH when the email update fails", async () => {
    updateUser.mockResolvedValue({ error: { message: "Email already in use" } });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("new@example.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.toast).toMatchObject({ title: "Error", description: "Email already in use", type: "error" });
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
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

    await waitFor(() => expect(result.current.speakerProfileId).toBe(5));
    expect(fetch).toHaveBeenCalledWith("/api/auth/me");
    expect(result.current.isSpeaker).toBe(true);
    expect(result.current.designation).toBe("CTO");
    expect(result.current.bio).toBe("Leads the team.");
    expect(result.current.linkedinUrl).toBe("https://linkedin.com/in/ada");
    expect(result.current.twitterUrl).toBe("");
    expect(result.current.githubUrl).toBe("https://github.com/ada");
    expect(result.current.websiteUrl).toBe("https://ada.dev");
  });

  it("does nothing for any non-speaker role", () => {
    const fetch = stubFetch();

    // Facilitators and admins outrank speakers, but the speaker profile section
    // belongs to the speaker row alone, so min-role must not admit them.
    for (const role of [ROLES.ATTENDEE, ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      sessionValue.mockReturnValue({ user: { ...user, role }, updateUser: sessionUpdateUser });
      const { result } = renderHook(() => useAccountSettings());

      expect(result.current.isSpeaker).toBe(false);
      expect(result.current.speakerProfileId).toBeUndefined();

      cleanup();
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it("waits for the speaker fetch before the seeded values count as clean", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());

    // Before the fetch answers, the empty seeds would look dirty against empty
    // saved originals; only after both land together is the group clean.
    expect(result.current.dirty).toBe(false);
    await waitFor(() => expect(result.current.speakerProfileId).toBe(5));
    expect(result.current.dirty).toBe(false);
  });
});

describe("saveChanges dirty-only submission", () => {
  const STRONG = "the quiet kettle sings";

  it("sends only the changed name when nothing else is dirty", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("Ada Lovelace"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Ada Lovelace" });
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(1);
    expect(updateUser).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("sends nothing when the form is untouched", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
    expect(updateUser).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("flags an emptied name and aborts before any request", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setName("  "));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.nameError).toBe("Name is required.");
    expect(fetch).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports the account's own address inline and writes nothing", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail(user.email));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.emailError).toBe("This is already your email address.");
    expect(updateUser).not.toHaveBeenCalled();
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
  });

  it("reports a dead domain inline with the suggestion and writes nothing", async () => {
    checkMailDomain.mockResolvedValue("no-mail-server");
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("ada@gmial.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.emailError).toBe("We could not find a mail server for gmial.com. Did you mean ada@gmail.com?");
    expect(updateUser).not.toHaveBeenCalled();
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
  });

  it("changes the password through saveChanges and clears the fields", async () => {
    updateUser.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).toHaveBeenCalledWith({ password: STRONG });
    expect(result.current.currentPassword).toBe("");
    expect(result.current.newPassword).toBe("");
  });

  it("batches name and password changes, leaving the untouched email alone", async () => {
    updateUser.mockResolvedValue({ error: null });
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setName("Grace Hopper");
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Grace Hopper" });
    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(1);
    expect(updateUser).toHaveBeenCalledWith({ password: STRONG });
    expect(checkMailDomain).not.toHaveBeenCalled();
  });

  it("flips dirty back to false once the dirty groups have been saved", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation(() => response({ ...user, full_name: "Ada Lovelace" }));
    const { result, rerender } = renderHook(() => useAccountSettings());
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setName("Ada Lovelace"));
    rerender();
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });
    rerender();
    expect(result.current.dirty).toBe(false);
  });

  it("keeps an untouched password group from counting as dirty", async () => {
    const { result } = renderHook(() => useAccountSettings());
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setName("Ada Lovelace"));

    expect(result.current.dirty).toBe(true);
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
    await waitFor(() => expect(result.current.speakerProfileId).toBe(5));
  }

  it("sends only the dirty speaker fields in the shared PATCH", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => result.current.setDesignation("CTO Emeritus"));
    act(() => result.current.setGithubUrl("https://github.com/ada-lovelace"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
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

    act(() => result.current.setLinkedinUrl(""));
    act(() => result.current.setWebsiteUrl(""));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
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

  it("flags an invalid URL on the owning field and aborts the whole batch", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => result.current.setGithubUrl("not a url"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.speakerFieldErrors).toEqual({ github: "Enter a valid full URL (https://…)." });
    expect(fetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("lets a name change through when a speaker URL is fine", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response({ ...speakerData, full_name: "Grace Hopper" }));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => result.current.setName("Grace Hopper"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ full_name: "Grace Hopper" });
  });

  it("sends no PATCH when a speaker has nothing to save", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(fetch.mock.calls.filter((c) => c[1]?.method === "PATCH")).toHaveLength(0);
    expect(result.current.dirty).toBe(false);
  });

  it("clears the field error when the offending link is edited again", async () => {
    useAsSpeaker();
    stubFetch().mockImplementation(() => response(speakerData));
    const { result } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);

    act(() => result.current.setGithubUrl("not a url"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });
    expect(result.current.speakerFieldErrors?.github).toBeTruthy();

    act(() => result.current.setGithubUrl("https://github.com/ada"));

    expect(result.current.speakerFieldErrors?.github).toBeUndefined();
  });

  it("flips speakerDirty back to clean once saved", async () => {
    useAsSpeaker();
    const fetch = stubFetch();
    fetch.mockImplementation(() => response(speakerData));
    const { result, rerender } = renderHook(() => useAccountSettings());
    await loadSpeaker(result);
    expect(result.current.speakerDirty).toBe(false);

    act(() => result.current.setBio("Fresh bio."));
    rerender();
    expect(result.current.speakerDirty).toBe(true);

    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });
    rerender();
    expect(result.current.speakerDirty).toBe(false);
  });
});

describe("the sent state", () => {
  it("starts a cooldown so a second link cannot be asked for immediately", async () => {
    updateUser.mockResolvedValue({ error: null });
    stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewEmail("grace@example.com"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
        await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
    });

    expect(updateUser).not.toHaveBeenCalled();
    expect(result.current.newPasswordError).toBe("Not built on a commonly used password");
  });

  it("refuses one built from the account's own name", async () => {
    sessionValue.mockReturnValue({
      user: { ...user, full_name: "Ada Lovelace", email: "ada.lovelace@example.com" },
      updateUser: sessionUpdateUser,
    });
    const { result } = renderHook(() => useAccountSettings());

    act(() => result.current.setNewPassword("adalovelace2026"));
    await act(async () => {
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.currentPassword).toBe("not-my-password");
    expect(result.current.newPassword).toBe(STRONG);
    expect(result.current.saving).toBe(false);
  });

  it("checks the password against the signed-in account", async () => {
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(verifyPassword).toHaveBeenCalledWith(user.email, "old-pass");
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
      await result.current.saveChanges(submitEvent);
    });

    expect(verifyPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses rather than checking when there is no signed-in email to check against", async () => {
    sessionValue.mockReturnValue({ user: { ...user, email: null }, updateUser: sessionUpdateUser });
    const { result } = renderHook(() => useAccountSettings());

    act(() => {
      result.current.setCurrentPassword("old-pass");
      result.current.setNewPassword(STRONG);
    });
    await act(async () => {
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
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
      await result.current.saveChanges(submitEvent);
    });
    expect(result.current.currentPasswordError).not.toBeNull();

    verifyPassword.mockResolvedValue(true);
    updateUser.mockResolvedValue({ error: null });
    await act(async () => {
      await result.current.saveChanges(submitEvent);
    });

    expect(result.current.currentPasswordError).toBeNull();
    expect(result.current.toast?.title).toBe("Password updated");
  });
});

describe("profile photo", () => {
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

  it("deletes the photo and nulls the session photo on success", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.deleteProfilePhoto();
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
      await result.current.deleteProfilePhoto();
    });

    rerender();
    expect(result.current.currentUser?.profile_image_url).toBeNull();
  });

  it("leaves the session photo alone and toasts an error when the delete fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "delete failed" }, false));
    const { result } = renderHook(() => useAccountSettings());

    await act(async () => {
      await result.current.deleteProfilePhoto();
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
