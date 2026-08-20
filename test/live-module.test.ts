import { describe, it, expect } from "vitest";
import { findLiveModule, type LiveModuleSource } from "@/shared/lib/live-module";
import { parseEventDateTime } from "@/shared/lib/date-utils";

const EVENT_DATE = "2026-09-01";

function module(id: number, start: string | null, end: string | null, speaker?: string | null): LiveModuleSource {
  return {
    id,
    module_name: `Module ${id}`,
    start_time: start,
    end_time: end,
    SPEAKER_PROFILE: speaker ? { id: id + 100, USER: { full_name: speaker } } : null,
  };
}

function at(hour: number, minute: number, second = 0): Date {
  // Built in the app timezone, the same clock the code under test reads.
  // A runtime-local Date passes on a machine in that zone and fails on CI.
  return parseEventDateTime(EVENT_DATE, `${hour}:${minute}:${second}`)!;
}

describe("findLiveModule", () => {
  it("returns the module whose half-open session contains now", () => {
    const modules = [module(1, "09:00:00", "10:00:00"), module(2, "10:00:00", "12:00:00"), module(3, "12:00:00", "15:00:00")];
    expect(findLiveModule(modules, EVENT_DATE, at(11, 30))?.id).toBe(2);
  });

  it("treats the start as live and the end as not", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    expect(findLiveModule(modules, EVENT_DATE, at(9, 0))?.id).toBe(1);
    expect(findLiveModule(modules, EVENT_DATE, at(10, 0))).toBeNull();
  });

  it("returns null before the first module and after the last", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    expect(findLiveModule(modules, EVENT_DATE, at(8, 59))).toBeNull();
    expect(findLiveModule(modules, EVENT_DATE, at(10, 1))).toBeNull();
  });

  it("skips modules missing either edge of the session", () => {
    const scheduled = module(1, "09:00:00", "10:00:00");
    const cleared = module(2, null, null);
    const halfOpen = module(3, "09:30:00", null);
    expect(findLiveModule([scheduled, cleared, halfOpen], EVENT_DATE, at(9, 45))?.id).toBe(1);
    expect(findLiveModule([cleared, halfOpen], EVENT_DATE, at(9, 45))).toBeNull();
  });

  it("ignores a session whose time does not parse", () => {
    const broken = module(1, "oops", "10:00:00");
    expect(findLiveModule([broken], EVENT_DATE, at(9, 30))).toBeNull();
  });

  it("returns nothing without an event date", () => {
    const modules = [module(1, "09:00:00", "10:00:00")];
    expect(findLiveModule(modules, "", at(9, 30))).toBeNull();
  });

  it("carries the speaker along with the live module", () => {
    const modules = [module(1, "09:00:00", "10:00:00", "Ada Lovelace")];
    expect(findLiveModule(modules, EVENT_DATE, at(9, 30))?.SPEAKER_PROFILE?.USER?.full_name).toBe("Ada Lovelace");
  });
});
