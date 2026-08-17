// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { createDraft, draftLesson, removeDraftLesson, updateDraftLesson } from "@/modules/courses/lib/module-draft";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { Lesson } from "@/shared/types";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function stubFetch() {
  const fn = vi.fn<FetchFn>();
  fn.mockResolvedValue({ ok: true, json: async () => ({ id: 99 }) } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function lesson(id: number, seq: number, overrides: Partial<Lesson> = {}): Lesson {
  return {
    id,
    module_id: 1,
    name: `Lesson ${id}`,
    description: null,
    content_type: "pdf",
    content_url: null,
    sequence_order: seq,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function mod(overrides: Partial<ModuleWithLessons> = {}): ModuleWithLessons {
  return {
    id: 1,
    course_id: 7,
    module_name: "Week one",
    sequence_order: 1,
    module_type: "lessons",
    is_locked: false,
    start_time: null,
    end_time: null,
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: [lesson(1, 1), lesson(2, 2)],
    ...overrides,
  };
}

/** Requests in the order they were issued, as "METHOD path". */
function calls(fetch: ReturnType<typeof stubFetch>): string[] {
  return fetch.mock.calls.map((c) => `${c[1]?.method ?? "GET"} ${String(c[0])}`);
}

function bodyOf(fetch: ReturnType<typeof stubFetch>, match: string): Record<string, unknown> {
  const call = fetch.mock.calls.find((c) => String(c[0]).includes(match) && c[1]?.body);
  return JSON.parse(call![1]!.body as string);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function save(source: ModuleWithLessons, edit: (d: ReturnType<typeof createDraft>) => ReturnType<typeof createDraft>) {
  const fetch = stubFetch();
  const { result } = renderHook(() => useCourseCreate("9"));
  act(() => result.current.setModules([source]));

  let failure: string | null = "sentinel";
  await act(async () => {
    failure = await result.current.handleSaveModule(edit(createDraft(source)));
  });
  return { fetch, failure: failure as string | null };
}

describe("handleSaveModule", () => {
  it("writes nothing when the draft matches the module", async () => {
    const { fetch, failure } = await save(mod(), (d) => d);

    expect(failure).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("patches the module once for a rename", async () => {
    const { fetch } = await save(mod(), (d) => ({ ...d, module_name: "Basics" }));

    expect(calls(fetch)).toContain("PATCH /api/modules/1");
    expect(bodyOf(fetch, "/api/modules/1").module_name).toBe("Basics");
  });

  it("sends the schedule as HH:MM, which is what the schema accepts", async () => {
    const source = mod({ start_time: "09:00:00", end_time: "10:00:00" });
    const { fetch } = await save(source, (d) => ({ ...d, start_time: "11:00", end_time: "12:00" }));

    expect(bodyOf(fetch, "/api/modules/1")).toMatchObject({ start_time: "11:00", end_time: "12:00" });
  });

  it("deletes a lesson removed from the draft", async () => {
    const { fetch } = await save(mod(), (d) => removeDraftLesson(d, "lesson-1"));

    expect(calls(fetch)).toContain("DELETE /api/lessons/1");
  });

  it("posts a lesson added to the draft", async () => {
    const { fetch } = await save(mod(), (d) => ({
      ...d,
      lessons: [...d.lessons, draftLesson({ name: "Intro", content_type: "link", content_url: "https://x.test" })],
    }));

    expect(calls(fetch)).toContain("POST /api/modules/1/lessons");
    expect(bodyOf(fetch, "/api/modules/1/lessons")).toMatchObject({ name: "Intro", sequence_order: 3 });
  });

  it("detaches material through the material route", async () => {
    const source = mod({ LESSONS: [lesson(1, 1, { content_url: "/api/storage/course_assets/a.pdf" })] });
    const { fetch } = await save(source, (d) => updateDraftLesson(d, "lesson-1", { dropMaterial: true }));

    expect(calls(fetch)).toContain("DELETE /api/lessons/1/material");
  });

  it("drops the old material before adding the replacement", async () => {
    const source = mod({ LESSONS: [lesson(1, 1, { content_url: "/api/storage/course_assets/a.pdf" })] });
    const file = new File(["x"], "new.pdf", { type: "application/pdf" });
    const { fetch } = await save(source, (d) => updateDraftLesson(d, "lesson-1", { dropMaterial: true, pendingFile: file }));

    const order = calls(fetch);
    expect(order.indexOf("DELETE /api/lessons/1/material")).toBeLessThan(order.findIndex((c) => c.includes("/api/upload/")));
  });

  it("reloads the course once the batch lands", async () => {
    const { fetch } = await save(mod(), (d) => ({ ...d, module_name: "Basics" }));

    expect(calls(fetch)).toContain("GET /api/courses/event/9");
  });

  it("stops at the first refusal and returns its message", async () => {
    const fetch = stubFetch();
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Name already used" }) } as Response);

    const source = mod();
    const { result } = renderHook(() => useCourseCreate("9"));
    act(() => result.current.setModules([source]));

    let failure: string | null = null;
    await act(async () => {
      failure = await result.current.handleSaveModule({ ...createDraft(source), module_name: "Basics" });
    });

    expect(failure).toBe("Name already used");
    // The module PATCH refused, so nothing after it was attempted.
    expect(calls(fetch)).toEqual(["PATCH /api/modules/1"]);
  });
});
