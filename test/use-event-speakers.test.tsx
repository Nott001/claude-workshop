// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";

// Exactly what the two endpoints serve. GET /api/speakers is speakerDao.list:
// SPEAKER_PROFILE rows keyed on `id`, with a singular USER embed. GET
// /api/events/:id/speakers is listEventAssignments: EVENT_SPEAKER rows, which
// really do carry `speaker_profile_id`, with a singular SPEAKER_PROFILE embed.
const profiles = [
  { id: 3, user_id: 30, bio: null, designation: "CTO", USER: { full_name: "Ada Lovelace", email: "ada@example.com" } },
  { id: 4, user_id: 40, bio: null, designation: null, USER: { full_name: "Grace Hopper", email: "grace@example.com" } },
];

const assignments = [{ event_id: 1, speaker_profile_id: 3, SPEAKER_PROFILE: { id: 3, user_id: 30 } }];

function stubApi(speakerRows: unknown = profiles, assignmentRows: unknown = assignments) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => (url === "/api/speakers" ? speakerRows : assignmentRows),
      }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useEventSpeakers", () => {
  it("keys profiles on the id the API actually returns", async () => {
    stubApi();

    const { result } = renderHook(() => useEventSpeakers("1"));

    await waitFor(() => expect(result.current.allProfiles).toHaveLength(2));
    expect(result.current.allProfiles.map((p) => p.id)).toEqual([3, 4]);
    expect(result.current.allProfiles.every((p) => p.id !== undefined)).toBe(true);
  });

  it("drops an already-assigned speaker from the options", async () => {
    stubApi();

    const { result } = renderHook(() => useEventSpeakers("1"));

    // Profile 3 is assigned, so only 4 remains selectable. The filter compared
    // a non-existent `speaker_profile_id` before, so nothing was ever removed
    // and the dropdown re-offered speakers already on the event.
    await waitFor(() => expect(result.current.availableProfiles).toHaveLength(1));
    expect(result.current.availableProfiles[0].id).toBe(4);
  });

  it("gives every option a distinct, defined key", async () => {
    stubApi(profiles, []);

    const { result } = renderHook(() => useEventSpeakers("1"));

    await waitFor(() => expect(result.current.availableProfiles).toHaveLength(2));
    const keys = result.current.availableProfiles.map((p) => p.id);
    expect(keys.some((k) => k === undefined)).toBe(false);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("exposes the speaker's name from the singular USER embed", async () => {
    stubApi();

    const { result } = renderHook(() => useEventSpeakers("1"));

    await waitFor(() => expect(result.current.allProfiles).toHaveLength(2));
    expect(result.current.allProfiles.map((p) => p.USER?.full_name)).toEqual(["Ada Lovelace", "Grace Hopper"]);
  });

  it("reads the assignment's speaker_profile_id, which EVENT_SPEAKER really has", async () => {
    stubApi();

    const { result } = renderHook(() => useEventSpeakers("1"));

    await waitFor(() => expect(result.current.assignments).toHaveLength(1));
    expect(result.current.assignedIds.has(3)).toBe(true);
  });

  it("posts a real profile id when assigning, not NaN", async () => {
    stubApi(profiles, []);

    const { result } = renderHook(() => useEventSpeakers("1"));
    await waitFor(() => expect(result.current.availableProfiles).toHaveLength(2));

    // What the <option value> yields once it carries a defined id.
    result.current.setSelectedProfileId(String(result.current.availableProfiles[0].id));
    await waitFor(() => expect(result.current.selectedProfileId).toBe("3"));

    await result.current.handleAssign({ preventDefault: () => {} } as React.FormEvent);

    const post = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[1]?.method === "POST");
    expect(JSON.parse(post![1].body)).toEqual({ speaker_profile_id: 3 });
  });

  it("reports a failed load instead of rendering an empty roster", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));

    const { result } = renderHook(() => useEventSpeakers("1"));

    await waitFor(() => expect(result.current.error).toBe("Failed to load data"));
  });
});
