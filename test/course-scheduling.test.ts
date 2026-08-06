import { describe, it, expect } from "vitest";
import { endConflict, findTimeOverlaps, startConflict, type ScheduleWindow } from "@/modules/courses/lib/scheduling";

function moduleFixture(partial: Partial<{ start_time: string | null; end_time: string | null }>) {
  return { module_name: "M", sequence_order: 1, start_time: null, end_time: null, ...partial };
}

function window(id: number, start: string | null, end: string | null): ScheduleWindow {
  return { id, module_name: `Module ${id}`, start_time: start, end_time: end };
}

describe("findTimeOverlaps", () => {
  it("passes adjacent windows, which touch only at the boundary", () => {
    const a = moduleFixture({ start_time: "09:00", end_time: "10:00" });
    const b = moduleFixture({ start_time: "10:00", end_time: "12:00" });
    expect(findTimeOverlaps([a, b])).toEqual([]);
  });

  it("detects a partial overlap", () => {
    const a = moduleFixture({ start_time: "09:00", end_time: "11:00" });
    const b = moduleFixture({ start_time: "10:00", end_time: "12:00" });
    expect(findTimeOverlaps([a, b])).toEqual([[a, b]]);
  });

  it("detects a contained overlap", () => {
    const a = moduleFixture({ start_time: "09:00", end_time: "12:00" });
    const b = moduleFixture({ start_time: "10:00", end_time: "11:00" });
    expect(findTimeOverlaps([a, b])).toEqual([[a, b]]);
  });

  it("skips modules missing either time", () => {
    const scheduled = moduleFixture({ start_time: "09:00", end_time: "10:00" });
    const cleared = moduleFixture({ start_time: null, end_time: null });
    const halfOpen = moduleFixture({ start_time: "10:00", end_time: null });
    expect(findTimeOverlaps([scheduled, cleared, halfOpen])).toEqual([]);
  });

  it("returns multiple pairs together, in input order", () => {
    const a = moduleFixture({ start_time: "09:00", end_time: "10:00" });
    const b = moduleFixture({ start_time: "09:30", end_time: "10:30" });
    const c = moduleFixture({ start_time: "10:00", end_time: "11:00" });
    const d = moduleFixture({ start_time: "10:30", end_time: "11:30" });
    expect(findTimeOverlaps([a, b, c, d])).toEqual([
      [a, b],
      [b, c],
      [c, d],
    ]);
  });

  it("compares by minutes, not strings", () => {
    const a = moduleFixture({ start_time: "00:00", end_time: "23:59" });
    const b = moduleFixture({ start_time: "12:00", end_time: "13:00" });
    expect(findTimeOverlaps([a, b])).toEqual([[a, b]]);
  });
});

describe("startConflict", () => {
  const other = window(1, "09:00", "10:00");

  it("blocks a start whose window overlaps another module once the end is known", () => {
    const target = window(2, null, "10:30");
    const conflict = startConflict([target, other], 2, "09:45");

    expect(conflict?.kind).toBe("overlap");
  });

  it("allows an adjacent start at another module's end", () => {
    const target = window(2, null, "11:00");
    expect(startConflict([target, other], 2, "10:00")).toBeNull();
  });

  it("blocks a start inside another window before the end is known", () => {
    const target = window(2, null, null);
    const conflict = startConflict([target, other], 2, "09:30");

    expect(conflict?.kind).toBe("overlap");
  });

  it("leaves a start outside every window open when the end is unknown", () => {
    const target = window(2, null, null);
    expect(startConflict([target, other], 2, "10:00")).toBeNull();
  });

  it("rejects a start at or after its own end", () => {
    const target = window(2, null, "10:00");
    const conflict = startConflict([target, other], 2, "10:30");

    expect(conflict?.kind).toBe("invalid");
  });
});

describe("endConflict", () => {
  const other = window(1, "10:00", "12:00");

  it("blocks an end before or at the start time", () => {
    const target = window(2, "10:00", null);
    const conflict = endConflict([target, other], 2, "09:30");

    expect(conflict?.kind).toBe("invalid");
  });

  it("blocks an end that makes the window overlap another module", () => {
    const target = window(2, "11:00", null);
    const conflict = endConflict([target, other], 2, "12:30");

    expect(conflict?.kind).toBe("overlap");
  });

  it("allows an end exactly at another module's start", () => {
    const target = window(2, "09:00", null);
    expect(endConflict([target, other], 2, "10:00")).toBeNull();
  });

  it("blocks an end inside another window before the start is known", () => {
    const target = window(2, null, null);
    const conflict = endConflict([target, other], 2, "11:00");

    expect(conflict?.kind).toBe("overlap");
  });

  it("leaves an end at another window's start open when the start is unknown", () => {
    const target = window(2, null, null);
    expect(endConflict([target, other], 2, "10:00")).toBeNull();
  });
});
