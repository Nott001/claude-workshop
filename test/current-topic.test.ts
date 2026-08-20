import { describe, it, expect } from "vitest";
import { resolveCurrentTopic } from "@/modules/courses/lib/current-topic";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { Lesson } from "@/shared/types";
import { parseEventDateTime } from "@/shared/lib/date-utils";

const EVENT_DATE = "2026-09-01";

function lesson(id: number, description: string, seq: number): Lesson {
  return {
    id,
    module_id: 10,
    name: description,
    description,
    content_type: "link",
    content_url: null,
    sequence_order: seq,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function module(
  id: number,
  name: string,
  type: "lessons" | "qa",
  start: string | null,
  end: string | null,
  lessons: Lesson[],
  speaker?: string,
): ModuleWithLessons {
  return {
    id,
    course_id: 1,
    module_name: name,
    sequence_order: id,
    module_type: type,
    is_locked: false,
    start_time: start,
    end_time: end,
    speaker_profile_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    LESSONS: lessons,
    SPEAKER_PROFILE: speaker ? { id: 100, designation: null, USER: { full_name: speaker } } : null,
  };
}

function at(hour: number, minute: number): Date {
  // Built in the app timezone, the same clock the code under test reads.
  // A runtime-local Date passes on a machine in that zone and fails on CI.
  return parseEventDateTime(EVENT_DATE, `${hour}:${minute}`)!;
}

describe("resolveCurrentTopic", () => {
  it("prefers the explicit highlight even when another module is live", () => {
    const modules = [
      module(1, "Foundations", "lessons", "09:00:00", "10:00:00", [lesson(11, "Introduction", 1)], "Ada Lovelace"),
      module(2, "Applied workflows", "lessons", "10:00:00", "12:00:00", [lesson(21, "Using Projects", 1)]),
    ];

    const topic = resolveCurrentTopic(modules, EVENT_DATE, 11, at(10, 30));

    expect(topic?.lesson.name).toBe("Introduction");
    expect(topic?.moduleName).toBe("Foundations");
    expect(topic?.speakerName).toBe("Ada Lovelace");
  });

  it("falls back to the live module's first lesson by sequence order", () => {
    const modules = [
      module(1, "Foundations", "lessons", "09:00:00", "10:00:00", [lesson(11, "Introduction", 1)]),
      module(2, "Applied workflows", "lessons", "10:00:00", "12:00:00", [
        lesson(22, "Automating notes", 2),
        lesson(21, "Using Projects", 1),
      ]),
    ];

    const topic = resolveCurrentTopic(modules, EVENT_DATE, null, at(10, 30));

    expect(topic?.lesson.name).toBe("Using Projects");
    expect(topic?.moduleName).toBe("Applied workflows");
  });

  it("returns null when no highlight is set and no module is live", () => {
    const modules = [module(1, "Foundations", "lessons", "09:00:00", "10:00:00", [lesson(11, "Introduction", 1)])];

    expect(resolveCurrentTopic(modules, EVENT_DATE, null, at(12, 0))).toBeNull();
  });

  it("never reaches into a qa module for the fallback", () => {
    const modules = [module(1, "Wrap-up", "qa", "10:00:00", "12:00:00", [])];

    expect(resolveCurrentTopic(modules, EVENT_DATE, null, at(10, 30))).toBeNull();
  });

  it("returns null when the highlight names an unknown lesson", () => {
    const modules = [module(1, "Foundations", "lessons", "09:00:00", "10:00:00", [lesson(11, "Introduction", 1)])];

    expect(resolveCurrentTopic(modules, EVENT_DATE, 999, at(9, 30))).toBeNull();
  });
});
