// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";

const sessionValue = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => sessionValue(),
}));

import { useSpeakerProfile } from "@/modules/user/lib/use-speaker-profile";

const speaker = { id: 1, role: "speaker", full_name: "Ada", email: "ada@example.com", profile_image_url: null };
const attendee = { id: 2, role: "attendee", full_name: "Bo", email: "bo@example.com", profile_image_url: null };

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
    fetch.mockImplementation(() => response({ speaker_profile_id: 5, designation: "CTO", bio: "Leads the team." }));
    const notify = vi.fn();

    const { result } = renderHook(() => useSpeakerProfile(notify));

    await waitFor(() => expect(result.current.speakerProfileId).toBe(5));
    expect(fetch).toHaveBeenCalledWith("/api/auth/me");
    expect(result.current.isSpeaker).toBe(true);
    expect(result.current.designation).toBe("CTO");
    expect(result.current.bio).toBe("Leads the team.");
  });

  it("does nothing for a non-speaker", () => {
    sessionValue.mockReturnValue({ user: attendee });
    const fetch = stubFetch();
    const notify = vi.fn();

    const { result } = renderHook(() => useSpeakerProfile(notify));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.isSpeaker).toBe(false);
    expect(result.current.speakerProfileId).toBeUndefined();
  });

  it("saves designation and bio via PATCH /api/auth/me and notifies success", async () => {
    const fetch = stubFetch();
    const notify = vi.fn();
    const { result } = renderHook(() => useSpeakerProfile(notify));
    await waitFor(() => expect(result.current.speakerProfileId !== undefined).toBe(true));

    act(() => {
      result.current.setDesignation("CTO");
      result.current.setBio("Leads.");
    });
    await act(async () => {
      await result.current.saveSpeakerProfile(submitEvent);
    });

    const patch = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(JSON.parse(patch![1]!.body as string)).toEqual({ designation: "CTO", bio: "Leads." });
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
