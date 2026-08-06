import { describe, it, expect } from "vitest";
import { findTimeOverlaps } from "@/modules/courses/lib/scheduling";

function moduleFixture(partial: Partial<{ start_time: string | null; end_time: string | null }>) {
  return { module_name: "M", sequence_order: 1, start_time: null, end_time: null, ...partial };
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
