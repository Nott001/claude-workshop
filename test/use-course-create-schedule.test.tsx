// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function stubFetch() {
  const fn = vi.fn<FetchFn>();
  vi.stubGlobal("fetch", fn);
  return fn;
}

function mod(
  id: number,
  name: string,
  sequenceOrder: number,
  times: { start_time: string | null; end_time: string | null },
): ModuleWithLessons {
  return {
    id,
    course_id: 7,
    module_name: name,
    sequence_order: sequenceOrder,
    module_type: "lessons",
    is_locked: false,
    start_time: times.start_time,
    end_time: times.end_time,
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: [],
  };
}

function patchBody(fetch: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const call = fetch.mock.calls.find((c) => c[1]?.method === "PATCH");
  return JSON.parse(call![1]!.body as string);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCourseCreate schedule edits", () => {
  it("applies a schedule edit optimistically and returns no error on success", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useCourseCreate("9"));
    const weekOne = mod(1, "Week one", 1, { start_time: null, end_time: null });
    act(() => result.current.setModules([weekOne]));
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    let error: string | null = "sentinel";
    await act(async () => {
      error = await result.current.handleUpdateModuleSchedule(1, {
        start_time: "09:00",
        end_time: "10:00",
        speaker_profile_id: null,
      });
    });

    expect(error).toBeNull();
    expect(result.current.modules[0]).toMatchObject({ start_time: "09:00", end_time: "10:00" });
    expect(patchBody(fetch)).toEqual({
      module_name: "Week one",
      sequence_order: 1,
      start_time: "09:00",
      end_time: "10:00",
      speaker_profile_id: null,
    });
  });

  it("restores the previous modules and returns the API error when the PATCH fails", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useCourseCreate("9"));
    const weekOne = mod(1, "Week one", 1, { start_time: "09:00", end_time: "10:00" });
    act(() => result.current.setModules([weekOne]));
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Time overlaps with "Hands-on"' } }),
    } as Response);

    let error: string | null = null;
    await act(async () => {
      error = await result.current.handleUpdateModuleSchedule(1, {
        start_time: "11:00",
        end_time: "12:00",
        speaker_profile_id: null,
      });
    });

    expect(error).toBe('Time overlaps with "Hands-on"');
    expect(result.current.modules[0]).toMatchObject({ start_time: "09:00", end_time: "10:00" });
  });

  it("falls back to a generic message when the API gives none", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useCourseCreate("9"));
    act(() => result.current.setModules([mod(1, "Week one", 1, { start_time: null, end_time: null })]));
    fetch.mockResolvedValue({ ok: false, json: async () => null } as Response);

    let error: string | null = null;
    await act(async () => {
      error = await result.current.handleUpdateModuleSchedule(1, {
        start_time: "09:00",
        end_time: "10:00",
        speaker_profile_id: null,
      });
    });

    expect(error).toBe("Failed to update schedule");
  });
});

describe("useCourseCreate reorder", () => {
  it("writes the swapped schedule fields back in each PATCH body", async () => {
    const fetch = stubFetch();
    const { result } = renderHook(() => useCourseCreate("9"));
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    // SPEC-03 swapped the sessions with the displaced neighbours.
    const reordered = [
      { ...mod(2, "Week two", 1, { start_time: "09:00", end_time: "10:00" }) },
      { ...mod(1, "Week one", 2, { start_time: "10:00", end_time: "11:00" }) },
    ];

    await act(async () => {
      await result.current.handleReorderModules(reordered);
    });

    const bodies = fetch.mock.calls.filter((c) => c[1]?.method === "PATCH").map((c) => JSON.parse(c[1]!.body as string));
    expect(bodies).toEqual([
      { module_name: "Week two", sequence_order: 1, start_time: "09:00", end_time: "10:00", speaker_profile_id: null },
      { module_name: "Week one", sequence_order: 2, start_time: "10:00", end_time: "11:00", speaker_profile_id: null },
    ]);
  });
});
