// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";

const sessionValue = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => sessionValue(),
}));

import { useSpeakerProfile } from "@/modules/user/lib/use-speaker-profile";

const speaker = { id: 1, role: ROLES.SPEAKER, full_name: "Ada", email: "ada@example.com", profile_image_url: null };
const attendee = { id: 2, role: ROLES.ATTENDEE, full_name: "Bo", email: "bo@example.com", profile_image_url: null };

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
  sessionValue.mockReturnValue({ user: speaker });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSpeakerProfile", () => {
  it("loads the speaker fields from /api/auth/me when the user is a speaker", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation(() =>
      response({
        speaker_profile_id: 5,
        designation: "CTO",
        bio: "Leads the team.",
        linkedin_url: "https://linkedin.com/in/ada",
        twitter_url: null,
        github_url: "https://github.com/ada",
        website_url: "https://ada.dev",
      }),
    );
    const notify = vi.fn();

    const { result } = renderHook(() => useSpeakerProfile(notify));

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
    const notify = vi.fn();

    // Facilitators and admins outrank speakers, but the speaker profile section
    // belongs to the speaker row alone, so min-role must not admit them.
    for (const role of [ROLES.ATTENDEE, ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      sessionValue.mockReturnValue({ user: { ...attendee, role } });
      const { result } = renderHook(() => useSpeakerProfile(notify));

      expect(result.current.isSpeaker).toBe(false);
      expect(result.current.speakerProfileId).toBeUndefined();

      cleanup();
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it("saves designation, bio, and links via PATCH /api/auth/me and notifies success", async () => {
    const fetch = stubFetch();
    const notify = vi.fn();
    const { result } = renderHook(() => useSpeakerProfile(notify));
    await waitFor(() => expect(result.current.speakerProfileId !== undefined).toBe(true));

    act(() => {
      result.current.setDesignation("CTO");
      result.current.setBio("Leads.");
      result.current.setLinkedinUrl(" https://linkedin.com/in/ada ");
      result.current.setTwitterUrl("");
      result.current.setGithubUrl("https://github.com/ada");
      result.current.setWebsiteUrl("https://ada.dev");
    });
    await act(async () => {
      await result.current.saveSpeakerProfile(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      designation: "CTO",
      bio: "Leads.",
      linkedin_url: "https://linkedin.com/in/ada",
      twitter_url: null,
      github_url: "https://github.com/ada",
      website_url: "https://ada.dev",
    });
    expect(notify).toHaveBeenCalledWith({ title: "Saved", description: "Professional info updated.", type: "success" });
  });

  it("notifies an error when saving fails", async () => {
    stubFetch().mockImplementation(() => response({ error: "Could not create profile" }, false));
    const notify = vi.fn();
    const { result } = renderHook(() => useSpeakerProfile(notify));

    await act(async () => {
      await result.current.saveSpeakerProfile(submitEvent);
    });

    expect(notify).toHaveBeenCalledWith({
      title: "Error",
      description: "Could not create profile",
      type: "error",
    });
  });
});
