// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";

const { swrState, mutate } = vi.hoisted(() => ({ swrState: vi.fn(), mutate: vi.fn() }));

vi.mock("swr", () => ({ default: () => swrState() }));

import { useAfterEventModules } from "@/modules/courses/lib/use-after-event-modules";

const MODULES = [
  { id: 4, module_name: "Deep dive", module_type: "lessons", sequence_order: 1, start_time: null, end_time: null },
  { id: 7, module_name: "Take-home", module_type: "lessons", sequence_order: 2, start_time: null, end_time: null },
];

function loaded(module_ids: number[] = [4]) {
  swrState.mockReturnValue({ data: { module_ids, modules: MODULES }, error: undefined, isLoading: false, mutate });
}

beforeEach(() => {
  vi.clearAllMocks();
  loaded();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ module_ids: [4, 7] }) }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useAfterEventModules", () => {
  it("starts from what the server holds, with nothing to save", () => {
    const { result } = renderHook(() => useAfterEventModules("12"));

    expect(result.current.selected).toEqual([4]);
    expect(result.current.dirty).toBe(false);
  });

  it("adds and removes a module locally before any save", () => {
    const { result } = renderHook(() => useAfterEventModules("12"));

    act(() => result.current.toggle(7));
    expect(result.current.selected).toEqual([4, 7]);
    expect(result.current.dirty).toBe(true);
    expect(fetch).not.toHaveBeenCalled();

    act(() => result.current.toggle(4));
    expect(result.current.selected).toEqual([7]);
  });

  it("is not dirty again once the selection matches the server, whatever the order", () => {
    // Ticking a box and unticking it is not an edit, and offering to save it
    // would have staff writing a map back unchanged.
    const { result } = renderHook(() => useAfterEventModules("12"));

    act(() => result.current.toggle(7));
    act(() => result.current.toggle(7));

    expect(result.current.dirty).toBe(false);
  });

  it("saves the whole selection in one write", async () => {
    const { result } = renderHook(() => useAfterEventModules("12"));

    act(() => result.current.toggle(7));
    await act(() => result.current.save());

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/events/12/after-event-modules",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ module_ids: [4, 7] }) }),
    );
    expect(mutate).toHaveBeenCalled();
  });

  it("keeps the edit on screen when the save is refused", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Those modules do not belong to this event's course" }),
    } as Response);
    const { result } = renderHook(() => useAfterEventModules("12"));

    act(() => result.current.toggle(7));
    await act(() => result.current.save());

    await waitFor(() => expect(result.current.error).toBe("Those modules do not belong to this event's course"));
    // Losing the selection here would make a failed save look like an undo.
    expect(result.current.selected).toEqual([4, 7]);
    expect(result.current.dirty).toBe(true);
  });

  it("reports a listing that would not load", () => {
    swrState.mockReturnValue({ data: undefined, error: new Error("nope"), isLoading: false, mutate });

    const { result } = renderHook(() => useAfterEventModules("12"));

    expect(result.current.error).toBe("Could not load this event's modules.");
    expect(result.current.modules).toEqual([]);
  });
});
