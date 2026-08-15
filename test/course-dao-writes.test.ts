import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dao from "@/shared/db/dao/course.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * A client whose answer depends on the table asked for, so the DAOs that read
 * several in one call can be exercised as one behaviour.
 */
function stub(byTable: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: Array<[string, string, unknown[]]> = [];

  const from = vi.fn((table: string) => {
    const result = byTable[table] ?? { data: null };
    const chain: Record<string, unknown> = {
      single: async () => result,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of ["select", "eq", "in", "neq", "order", "limit", "range", "insert", "update", "delete"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push([table, method, args]);
        return chain;
      };
    }
    return chain;
  });

  return { client: { from } as unknown as DbClient, calls, from };
}

const argsOf = (calls: Array<[string, string, unknown[]]>, table: string, method: string) =>
  calls.find(([t, m]) => t === table && m === method)?.[2];

beforeEach(() => {
  vi.clearAllMocks();
  // The write paths log the driver's message before giving up; the assertions
  // below are about the return value, not the noise.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("course.dao writes", () => {
  it("returns the created course", async () => {
    const { client } = stub({ COURSE: { data: { id: 4 }, error: null } });

    await expect(
      dao.createCourse(client, { course_name: "Intro", course_description: null, event_id: 9 }),
    ).resolves.toMatchObject({ course: { id: 4 } });
  });

  it("reports a rejected insert as no course", async () => {
    const { client } = stub({ COURSE: { data: null, error: { message: "violates foreign key", code: "23503" } } });

    await expect(dao.createCourse(client, { course_name: "Intro", course_description: null, event_id: 9 })).resolves.toEqual({
      course: null,
      reason: "failed",
    });
  });

  it("separates an event that already owns a course from a failed insert", async () => {
    const { client } = stub({
      COURSE: {
        data: null,
        error: { message: 'duplicate key value violates unique constraint "COURSE_event_id_key"', code: "23505" },
      },
    });

    await expect(dao.createCourse(client, { course_name: "Intro", course_description: null, event_id: 9 })).resolves.toEqual({
      course: null,
      reason: "conflict",
    });
  });

  it("defaults a new module to lessons rather than leaving its type unset", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2 }, error: null } });

    await dao.createModule(client, { course_id: 1, module_name: "Week one", sequence_order: 1 });

    expect((argsOf(calls, "MODULE", "insert") as [Record<string, unknown>])[0]).toMatchObject({ module_type: "lessons" });
  });

  it("keeps the module type the caller asked for", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2 }, error: null } });

    await dao.createModule(client, { course_id: 1, module_name: "Ask us", sequence_order: 2, module_type: "qa" });

    expect((argsOf(calls, "MODULE", "insert") as [Record<string, unknown>])[0]).toMatchObject({ module_type: "qa" });
  });

  it("stamps a lock change so the client can tell it moved", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2, is_locked: true }, error: null } });

    await dao.setModuleLock(client, 2, true);

    const [payload] = argsOf(calls, "MODULE", "update") as [Record<string, unknown>];
    expect(payload).toMatchObject({ is_locked: true });
    expect(payload).toHaveProperty("updated_at");
  });

  it("reports whether each delete landed", async () => {
    const ok = stub({ COURSE: { error: null }, MODULE: { error: null }, LESSON: { error: null } });
    const blocked = stub({ COURSE: { error: { message: "still referenced" } } });

    await expect(dao.deleteCourse(ok.client, 1)).resolves.toBe(true);
    await expect(dao.deleteModule(ok.client, 2)).resolves.toBe(true);
    await expect(dao.deleteLesson(ok.client, 3)).resolves.toBe(true);
    await expect(dao.deleteCourse(blocked.client, 1)).resolves.toBe(false);
  });

  it("reports a rejected edit as no row", async () => {
    const { client } = stub({ LESSON: { data: null, error: { message: "no such lesson", code: "PGRST116" } } });

    await expect(dao.updateLesson(client, 3, { description: "x" })).resolves.toBeNull();
  });

  it("forwards the schedule fields to updateModule", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2 }, error: null } });

    await dao.updateModule(client, 2, {
      module_name: "Renamed",
      sequence_order: 3,
      start_time: "09:00",
      end_time: "10:00",
      speaker_profile_id: 7,
    });

    const [payload] = argsOf(calls, "MODULE", "update") as [Record<string, unknown>];
    expect(payload).toMatchObject({ start_time: "09:00", end_time: "10:00", speaker_profile_id: 7 });
  });
});

describe("course.dao clearModuleSpeakerForEvent", () => {
  it("nulls the speaker's references on the event's course modules", async () => {
    const { client, calls } = stub({ COURSE: { data: { id: 5 } }, MODULE: { data: null, error: null } });

    await expect(dao.clearModuleSpeakerForEvent(client, 9, 7)).resolves.toBe(true);

    const [update] = argsOf(calls, "MODULE", "update") as [Record<string, unknown>];
    expect(update).toEqual({ speaker_profile_id: null });
    const eqCalls = calls.filter(([t, m]) => t === "MODULE" && m === "eq").map(([, , args]) => args);
    expect(eqCalls).toEqual([
      ["course_id", 5],
      ["speaker_profile_id", 7],
    ]);
  });

  it("is a no-op when the event has no course", async () => {
    const { client, from } = stub({ COURSE: { data: null } });

    await expect(dao.clearModuleSpeakerForEvent(client, 9, 7)).resolves.toBe(true);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("course.dao userHasCourseAccess", () => {
  const TICKETED = { COURSE: { data: { event_id: 9 } }, TICKET: { data: [{ id: 1 }] } };

  it("lets a ticket holder in", async () => {
    const { client } = stub(TICKETED);

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(true);
  });

  it("ignores a cancelled ticket", async () => {
    const { client, calls } = stub({ COURSE: { data: { event_id: 9 } }, TICKET: { data: null }, EVENT_SPEAKER: { data: [] } });

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(false);
    expect(argsOf(calls, "TICKET", "neq")).toEqual(["status", "cancelled"]);
  });

  it("lets an assigned speaker in without a ticket", async () => {
    const { client } = stub({
      COURSE: { data: { event_id: 9 } },
      TICKET: { data: null },
      EVENT_SPEAKER: { data: [{ event_id: 9 }] },
    });

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(true);
  });

  it("refuses when the course teaches no event at all", async () => {
    const { client, from } = stub({ COURSE: { data: { event_id: null } } });

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("course.dao reads throw on a failed query", () => {
  it("findCourseIdByEventId does not read a null off a dead database", async () => {
    const { client } = stub({ COURSE: { data: null, error: { message: "connection reset" } } });

    await expect(dao.findCourseIdByEventId(client, 9)).rejects.toThrow("course.dao.findCourseIdByEventId failed");
  });

  it("findModulesByCourse does not report no modules off a dead database", async () => {
    const { client } = stub({ MODULE: { data: null, error: { message: "connection reset" } } });

    await expect(dao.findModulesByCourse(client, 1)).rejects.toThrow("course.dao.findModulesByCourse failed");
  });

  it("findLessonsByModule does not report no lessons off a dead database", async () => {
    const { client } = stub({ LESSON: { data: null, error: { message: "connection reset" } } });

    await expect(dao.findLessonsByModule(client, 2)).rejects.toThrow("course.dao.findLessonsByModule failed");
  });

  it("userHasCourseAccess surfaces a failed speaker lookup rather than a refusal", async () => {
    const { client } = stub({
      COURSE: { data: { event_id: 9 } },
      TICKET: { data: null },
      EVENT_SPEAKER: { data: null, error: { message: "denied" } },
    });

    await expect(dao.userHasCourseAccess(client, 3, 1)).rejects.toThrow("course.dao.userHasCourseAccess.speaking failed");
  });
});
