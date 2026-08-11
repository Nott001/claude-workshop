import { describe, it, expect, vi } from "vitest";
import { findCourseByEvent, findCourseWithDetails, findCourseScheduleByEvent } from "@/shared/db/dao/course.dao";
import type { DbClient } from "@/shared/db/dao/types";

function courseQueryStub(payload: unknown) {
  const chain: Record<string, unknown> = {};
  const selects: string[] = [];
  for (const method of ["eq", "order"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.select = vi.fn((arg: string) => {
    selects.push(arg);
    return chain;
  });
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: payload ?? null, error: null }));
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, from, selects };
}

describe("course.dao module payload", () => {
  it("findCourseByEvent renames the embedded LESSON key to LESSONS", async () => {
    const { client } = courseQueryStub({
      id: 7,
      course_name: "Intro",
      MODULE: [{ id: 1, module_name: "M", LESSON: [{ id: 2, description: "first lesson" }] }],
    });

    const course = await findCourseByEvent(client, 7);

    expect(course?.MODULE[0]).toHaveProperty("LESSONS");
    expect(course?.MODULE[0]).not.toHaveProperty("LESSON");
    expect(course?.MODULE[0].LESSONS[0].description).toBe("first lesson");
  });

  it("findCourseByEvent resolves null when the event has no course", async () => {
    const { client } = courseQueryStub(null);

    await expect(findCourseByEvent(client, 7)).resolves.toBeNull();
  });

  it("findCourseWithDetails preserves the event embed while renaming lessons", async () => {
    const { client } = courseQueryStub({
      id: 7,
      MODULE: [{ id: 1, LESSON: [{ id: 2 }] }],
      EVENT: { id: 3, title: "Launch", event_date: "2026-01-01", status: "active" },
    });

    const course = await findCourseWithDetails(client, 7);

    expect(course?.MODULE[0].LESSONS).toHaveLength(1);
    expect(course?.MODULE[0]).not.toHaveProperty("LESSON");
    expect(course?.EVENT?.title).toBe("Launch");
  });

  it("findCourseWithDetails embeds the assigned speaker's name under MODULE", async () => {
    const { client, selects } = courseQueryStub({ id: 7, MODULE: [], EVENT: null });

    await findCourseWithDetails(client, 7);

    expect(selects[0]).toContain("SPEAKER_PROFILE (id, designation, USER (full_name))");
  });

  it("findCourseByEvent keeps the speaker embed while renaming lessons", async () => {
    const { client } = courseQueryStub({
      id: 7,
      MODULE: [
        {
          id: 1,
          module_name: "M",
          SPEAKER_PROFILE: { id: 4, designation: "Engineer", USER: { full_name: "Ada" } },
          LESSON: [],
        },
      ],
    });

    const course = await findCourseByEvent(client, 7);

    expect(course?.MODULE[0]?.SPEAKER_PROFILE?.USER?.full_name).toBe("Ada");
  });
});

describe("course.dao public schedule", () => {
  it("findCourseScheduleByEvent asks for schedule facts only and orders by sequence", async () => {
    const { client, selects } = courseQueryStub({
      MODULE: [
        {
          id: 1,
          module_name: "Intro",
          start_time: "09:00",
          end_time: "10:00",
          sequence_order: 1,
          speaker_profile_id: 7,
          SPEAKER_PROFILE: { USER: { full_name: "Ada" } },
        },
      ],
    });

    const modules = await findCourseScheduleByEvent(client, 7);

    expect(selects[0]).toContain(
      "MODULE(id, module_name, start_time, end_time, sequence_order, speaker_profile_id, SPEAKER_PROFILE(USER(full_name)))",
    );
    expect(selects[0]).not.toContain("LESSON");
    expect(modules?.[0]?.SPEAKER_PROFILE?.USER?.full_name).toBe("Ada");
  });

  it("findCourseScheduleByEvent resolves null when the event has no course", async () => {
    const { client } = courseQueryStub(null);

    await expect(findCourseScheduleByEvent(client, 7)).resolves.toBeNull();
  });
});
