// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

const { swrState, useAfterEventModules } = vi.hoisted(() => ({ swrState: vi.fn(), useAfterEventModules: vi.fn() }));

vi.mock("swr", () => ({ default: (...args: unknown[]) => swrState(...args) }));
vi.mock("@/modules/courses/lib/use-after-event-modules", () => ({ useAfterEventModules }));

import { useCourseContent } from "@/modules/courses/lib/use-course-content";
import { useCourseLibrary } from "@/modules/courses/lib/use-course-library";
import { AfterEventModulesPanel } from "@/modules/courses/components/after-event-modules-panel";

const COURSE = { id: 4, course_name: "Rust", MODULE: [] };

function swr(state: { data?: unknown; error?: unknown; isLoading?: boolean }) {
  swrState.mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: vi.fn(), ...state });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("useCourseContent", () => {
  it("waits while the fetch is in flight", () => {
    swr({ isLoading: true });

    expect(renderHook(() => useCourseContent("4")).result.current.access).toBe("loading");
  });

  it("reads a refused fetch as locked", () => {
    // The route answers 403 for a course the gate does not grant, and the
    // fetcher turns that into a thrown error.
    swr({ error: new Error("Request failed: 403") });

    expect(renderHook(() => useCourseContent("4")).result.current.access).toBe("locked");
  });

  it("separates a course that came back empty from one that was refused", () => {
    swr({ data: { course: null, grant: "staff", released_module_ids: [] } });

    expect(renderHook(() => useCourseContent("4")).result.current.access).toBe("missing");
  });

  it("carries the course, its grant and which modules were held back", () => {
    swr({ data: { course: COURSE, grant: "live", released_module_ids: [2] } });

    const { result } = renderHook(() => useCourseContent("4"));

    expect(result.current).toMatchObject({ access: "allowed", course: COURSE, grant: "live", releasedModuleIds: [2] });
  });

  it("asks for nothing without a course id", () => {
    swr({ isLoading: false });

    renderHook(() => useCourseContent(""));

    expect(swrState).toHaveBeenCalledWith(null, expect.anything(), expect.anything());
  });
});

describe("useCourseLibrary", () => {
  it("hands back the released courses", () => {
    swr({ data: { courses: [COURSE] } });

    expect(renderHook(() => useCourseLibrary()).result.current.courses).toEqual([COURSE]);
  });

  it("reports a listing that would not load, with no courses to show", () => {
    swr({ error: new Error("nope") });

    const { result } = renderHook(() => useCourseLibrary());

    expect(result.current.error).toBe("Could not load your courses.");
    expect(result.current.courses).toEqual([]);
  });
});

describe("AfterEventModulesPanel", () => {
  const base = {
    modules: [
      { id: 4, module_name: "Take-home", module_type: "lessons", sequence_order: 2, start_time: "13:00", end_time: "14:00" },
    ],
    selected: [] as number[],
    dirty: false,
    saving: false,
    loading: false,
    error: null as string | null,
    toggle: vi.fn(),
    save: vi.fn(),
  };

  it("lists this event's modules with where they sit in the day", () => {
    useAfterEventModules.mockReturnValue(base);

    render(<AfterEventModulesPanel eventId="12" />);

    expect(screen.getByText("Take-home")).toBeTruthy();
    expect(screen.getByText("Scheduled 1:00 PM – 2:00 PM")).toBeTruthy();
  });

  it("says so for a module with no session time of its own", () => {
    useAfterEventModules.mockReturnValue({
      ...base,
      modules: [{ ...base.modules[0], start_time: null, end_time: null }],
    });

    render(<AfterEventModulesPanel eventId="12" />);

    expect(screen.getByText("No session time set")).toBeTruthy();
  });

  it("checks the modules already held back", () => {
    useAfterEventModules.mockReturnValue({ ...base, selected: [4] });

    render(<AfterEventModulesPanel eventId="12" />);

    expect(screen.getByRole("checkbox")).toHaveProperty("checked", true);
  });

  it("offers a save only once something has changed", () => {
    useAfterEventModules.mockReturnValue(base);
    const { unmount } = render(<AfterEventModulesPanel eventId="12" />);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    unmount();

    useAfterEventModules.mockReturnValue({ ...base, dirty: true });
    render(<AfterEventModulesPanel eventId="12" />);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("toggles a module through the hook rather than its own state", () => {
    const toggle = vi.fn();
    useAfterEventModules.mockReturnValue({ ...base, toggle });

    render(<AfterEventModulesPanel eventId="12" />);
    fireEvent.click(screen.getByRole("checkbox"));

    expect(toggle).toHaveBeenCalledWith(4);
  });

  it("says so when the course has no modules to hold back", () => {
    useAfterEventModules.mockReturnValue({ ...base, modules: [] });

    render(<AfterEventModulesPanel eventId="12" />);

    expect(screen.getByText("This event's course has no modules to hold back yet.")).toBeTruthy();
  });

  it("shows the save in flight and surfaces a failure", () => {
    useAfterEventModules.mockReturnValue({
      ...base,
      dirty: true,
      saving: true,
      error: "Could not save which modules are held back.",
    });

    render(<AfterEventModulesPanel eventId="12" />);

    expect(screen.getByRole("button", { name: "Saving..." })).toBeTruthy();
    expect(screen.getByText("Could not save which modules are held back.")).toBeTruthy();
  });

  it("waits rather than claiming there is nothing to hold back", () => {
    useAfterEventModules.mockReturnValue({ ...base, modules: [], loading: true });

    render(<AfterEventModulesPanel eventId="12" />);

    expect(screen.getByText("Loading modules...")).toBeTruthy();
  });
});
