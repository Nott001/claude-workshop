// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";

// Exactly what GET /api/events/:id/speakers serves after the DAO change:
// EVENT_SPEAKER rows carrying the singular SPEAKER_PROFILE embed, which now
// itself carries the speaker's name.
const rows = [
  {
    event_id: 1,
    speaker_profile_id: 7,
    SPEAKER_PROFILE: { id: 7, user_id: 70, designation: "CTO", USER: { full_name: "Ada Lovelace" } },
  },
  {
    event_id: 1,
    speaker_profile_id: 9,
    SPEAKER_PROFILE: { id: 9, user_id: 90, designation: null, USER: { full_name: "Grace Hopper" } },
  },
];

function stubApi(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useAssignedSpeakers", () => {
  it("maps the roster to the builder's { speaker_profile_id, full_name } shape", async () => {
    stubApi(200, rows);

    const { result } = renderHook(() => useAssignedSpeakers("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.speakers).toEqual([
      { speaker_profile_id: 7, full_name: "Ada Lovelace" },
      { speaker_profile_id: 9, full_name: "Grace Hopper" },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("fetches the event's speakers endpoint", async () => {
    stubApi(200, []);

    const { result } = renderHook(() => useAssignedSpeakers("42"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledWith("/api/events/42/speakers");
  });

  it("drops an assignment whose user row is missing", async () => {
    stubApi(200, [{ event_id: 1, speaker_profile_id: 5, SPEAKER_PROFILE: null }]);

    const { result } = renderHook(() => useAssignedSpeakers("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.speakers).toEqual([]);
  });

  it("reports a failed load instead of an empty roster", async () => {
    stubApi(403, { error: "Forbidden" });

    const { result } = renderHook(() => useAssignedSpeakers("1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load speakers");
    expect(result.current.speakers).toEqual([]);
  });
});
