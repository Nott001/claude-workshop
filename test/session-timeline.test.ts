import { describe, it, expect } from "vitest";
import { buildTimeline } from "@/modules/events/lib/session-timeline";
import type { LiveModuleSource } from "@/modules/events/lib/live-module";

const EVENT_DATE = "2026-09-01";

function module(id: number, start: string | null, end: string | null): LiveModuleSource {
  return {
    id,
    module_name: `Module ${id}`,
    start_time: start,
    end_time: end,
    SPEAKER_PROFILE: null,
  };
}

function at(hour: number, minute: number): Date {
  return new Date(`${EVENT_DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
}

describe("buildTimeline", () => {
  it("orders scheduled modules chronologically, not by input order", () => {
    const modules = [module(1, "12:00:00", "13:00:00"), module(2, "09:00:00", "10:00:00"), module(3, "10:00:00", "12:00:00")];
    expect(buildTimeline(modules, EVENT_DATE, at(8, 0)).map((e) => e.module.id)).toEqual([2, 3, 1]);
  });

  it("marks a module live while its half-open session runs", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "10:00:00", "12:00:00"), module(3, "12:00:00", "15:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, at(10, 30));

    expect(timeline.map((e) => e.status)).toEqual(["completed", "live", "upcoming"]);
  });

  it("treats the start as live and the end as completed", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "10:00:00", "12:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, at(10, 0));

    expect(timeline[0].status).toBe("completed");
    expect(timeline[1].status).toBe("live");
  });

  it("excludes modules without a full session", () => {
    const modules = [
      module(1, "09:00:00", "10:00:00"),
      module(2, null, null),
      module(3, "10:00:00", null),
      module(4, null, "11:00:00"),
    ];
    expect(buildTimeline(modules, EVENT_DATE, at(9, 30)).map((e) => e.module.id)).toEqual([1]);
  });

  it("excludes sessions whose times do not parse", () => {
    const modules = [module(1, "oops", "10:00:00")];
    expect(buildTimeline(modules, EVENT_DATE, at(9, 30))).toEqual([]);
  });

  it("returns an empty roadmap without an event date", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    expect(buildTimeline(modules, "", at(9, 30))).toEqual([]);
  });
});
