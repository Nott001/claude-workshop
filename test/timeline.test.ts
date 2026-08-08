import { describe, it, expect } from "vitest";
import { buildTimeline } from "@/modules/events/lib/timeline";
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
    expect(
      buildTimeline(modules, EVENT_DATE, null, null, at(8, 0)).map((e) => (e.kind === "module" ? e.module.id : e.kind)),
    ).toEqual([2, 3, 1]);
  });

  it("marks a module live while its half-open session runs", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "10:00:00", "12:00:00"), module(3, "12:00:00", "15:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, null, null, at(10, 30));

    expect(timeline.map((e) => e.status)).toEqual(["completed", "live", "upcoming"]);
  });

  it("treats the start as live and the end as completed", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "10:00:00", "12:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, null, null, at(10, 0));

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
    expect(
      buildTimeline(modules, EVENT_DATE, null, null, at(9, 30)).map((e) => (e.kind === "module" ? e.module.id : e.kind)),
    ).toEqual([1]);
  });

  it("excludes sessions whose times do not parse", () => {
    const modules = [module(1, "oops", "10:00:00")];
    expect(buildTimeline(modules, EVENT_DATE, null, null, at(9, 30))).toEqual([]);
  });

  it("returns an empty roadmap without an event date", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    expect(buildTimeline(modules, "", null, null, at(9, 30))).toEqual([]);
  });

  it("includes event start and end bookends when times are provided", () => {
    const modules = [module(1, "10:00:00", "11:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, "09:00:00", "12:00:00", at(8, 0));

    expect(timeline).toHaveLength(3);
    expect(timeline[0]).toEqual({ kind: "bookend", label: "Event start", time: "09:00:00", status: "upcoming", position: 0 });
    expect(timeline[1].kind).toBe("module");
    expect(timeline[2]).toEqual({ kind: "bookend", label: "Event end", time: "12:00:00", status: "upcoming", position: 1 });
  });

  it("marks event start completed once the event has begun", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, "09:00:00", "12:00:00", at(9, 30));

    expect(timeline[0].kind).toBe("bookend");
    expect(timeline[0].status).toBe("completed");
  });

  it("marks event end completed once the event has ended", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, "09:00:00", "12:00:00", at(13, 0));

    const endBookend = timeline.find((e) => e.kind === "bookend" && e.label === "Event end");
    expect(endBookend).toBeDefined();
    expect(endBookend!.status).toBe("completed");
  });

  it("omits bookends when event times are not provided", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, null, null, at(9, 30));

    expect(timeline.every((e) => e.kind === "module")).toBe(true);
  });

  it("assigns position 0 to event start and 1 to event end", () => {
    const modules = [module(1, "10:00:00", "11:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, "09:00:00", "12:00:00", at(8, 0));

    const start = timeline[0];
    const end = timeline[2];
    expect(start.kind).toBe("bookend");
    expect(start.position).toBe(0);
    expect(end.kind).toBe("bookend");
    expect(end.position).toBe(1);
  });

  it("positions modules proportionally within the event window", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "12:00:00", "13:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, "09:00:00", "15:00:00", at(8, 0));

    const mod1 = timeline.find((e) => e.kind === "module" && e.module.id === 1);
    const mod2 = timeline.find((e) => e.kind === "module" && e.module.id === 2);
    expect(mod1!.position).toBe(0);
    expect(mod2!.position).toBe(0.5);
  });

  it("falls back to module-relative positions when event times are missing", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "15:00:00", "16:00:00")];
    const timeline = buildTimeline(modules, EVENT_DATE, null, null, at(8, 0));

    const mod1 = timeline.find((e) => e.kind === "module" && e.module.id === 1);
    const mod2 = timeline.find((e) => e.kind === "module" && e.module.id === 2);
    expect(mod1!.position).toBe(0);
    expect(mod2!.position).toBeCloseTo(6 / 7);
  });
});
