import { describe, it, expect } from "vitest";
import {
  afterEventModulesSchema,
  releaseFor,
  releasingEventIds,
  visibleModules,
  withRelease,
  type AfterEventModules,
} from "@/modules/courses/lib/after-event-modules";

const MAP: AfterEventModules = { version: 1, releases: { "12": [4, 7], "13": [9] } };

describe("afterEventModulesSchema", () => {
  it("accepts the stored shape", () => {
    expect(afterEventModulesSchema.safeParse(MAP).success).toBe(true);
  });

  it("rejects a row edited into a shape a gate must never read", () => {
    // The row is meant to be edited by hand, so each of these is a plausible
    // slip — and each would otherwise reach the release rule unchecked.
    expect(afterEventModulesSchema.safeParse({ version: 1, releases: { "12": ["4"] } }).success).toBe(false);
    expect(afterEventModulesSchema.safeParse({ version: 1, releases: { twelve: [4] } }).success).toBe(false);
    expect(afterEventModulesSchema.safeParse({ version: 2, releases: {} }).success).toBe(false);
    expect(afterEventModulesSchema.safeParse({ version: 1, releases: { "12": [0] } }).success).toBe(false);
  });
});

describe("reading the map", () => {
  it("gives an event's held-back modules, and none for an event with no release", () => {
    expect(releaseFor(MAP, 12)).toEqual([4, 7]);
    expect(releaseFor(MAP, 99)).toEqual([]);
  });

  it("lists only the events actually holding something back", () => {
    const withEmpty: AfterEventModules = { version: 1, releases: { ...MAP.releases, "14": [] } };

    expect(releasingEventIds(withEmpty).sort()).toEqual([12, 13]);
  });
});

describe("withRelease", () => {
  it("replaces one event's release and leaves the others alone", () => {
    const next = withRelease(MAP, 12, [9]);

    expect(next.releases["12"]).toEqual([9]);
    expect(next.releases["13"]).toEqual([9]);
  });

  it("drops the key rather than storing an empty release", () => {
    expect(withRelease(MAP, 12, []).releases).not.toHaveProperty("12");
  });

  it("stores each module once, in a stable order", () => {
    // The map is read by people as well as code; an unsorted list with a
    // duplicate in it is a diff nobody can review.
    expect(withRelease(MAP, 12, [9, 4, 9]).releases["12"]).toEqual([4, 9]);
  });

  it("does not mutate the map it was given", () => {
    withRelease(MAP, 12, [1]);

    expect(MAP.releases["12"]).toEqual([4, 7]);
  });
});

describe("visibleModules", () => {
  const modules = [{ id: 1 }, { id: 4 }, { id: 7 }];
  const released = [4, 7];

  it("shows nothing before the event opens", () => {
    expect(visibleModules(modules, released, { started: false, finished: false, isStaff: false })).toEqual([]);
  });

  it("shows the session's own modules once it starts, and holds the rest back", () => {
    const visible = visibleModules(modules, released, { started: true, finished: false, isStaff: false });

    expect(visible).toEqual([{ id: 1 }]);
  });

  it("releases the held-back modules the moment the event finishes", () => {
    const visible = visibleModules(modules, released, { started: true, finished: true, isStaff: false });

    expect(visible).toEqual(modules);
  });

  it("shows staff the whole curriculum at any hour, since they assemble it", () => {
    expect(visibleModules(modules, released, { started: false, finished: false, isStaff: true })).toEqual(modules);
  });

  it("holds nothing back when the event releases nothing", () => {
    expect(visibleModules(modules, [], { started: true, finished: false, isStaff: false })).toEqual(modules);
  });

  it("ignores a released id that names no module of this course", () => {
    // A module deleted after the release was saved leaves a dead id behind.
    expect(visibleModules(modules, [999], { started: true, finished: false, isStaff: false })).toEqual(modules);
  });
});
