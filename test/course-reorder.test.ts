import { describe, it, expect } from "vitest";
import { describeLessonMove, describeModuleMove, moveModule, moveLesson } from "@/modules/courses/lib/reorder";
import type { Lesson } from "@/shared/types";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";

function lesson(id: number, moduleId: number, sequenceOrder: number): Lesson {
  return {
    id,
    module_id: moduleId,
    description: `Lesson ${id}`,
    content_type: "pdf",
    content_url: null,
    sequence_order: sequenceOrder,
    created_at: "",
    updated_at: "",
  };
}

function mod(id: number, moduleType: "lessons" | "qa", lessons: Lesson[], sequenceOrder: number): ModuleWithLessons {
  return {
    id,
    course_id: 1,
    module_name: `Module ${id}`,
    sequence_order: sequenceOrder,
    module_type: moduleType,
    is_locked: false,
    start_time: null,
    end_time: null,
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: lessons,
  };
}

const lessonsModule = (id: number, lessons: Lesson[], sequenceOrder: number) => mod(id, "lessons", lessons, sequenceOrder);

function sortedModules(modules: ModuleWithLessons[]): ModuleWithLessons[] {
  return modules.map((m, i) => ({ ...m, sequence_order: i + 1 }));
}

describe("describeModuleMove", () => {
  it("names the module it would trade places with", () => {
    const modules = sortedModules([lessonsModule(1, [], 1), lessonsModule(2, [], 2)]);
    expect(describeModuleMove(modules, 2, "up")).toEqual({
      possible: true,
      direction: "up",
      targetModuleId: 1,
      targetModuleName: "Module 1",
    });
  });

  it("reports boundary moves as impossible", () => {
    const modules = sortedModules([lessonsModule(1, [], 1)]);
    expect(describeModuleMove(modules, 1, "up").possible).toBe(false);
    expect(describeModuleMove(modules, 1, "down").possible).toBe(false);
  });

  it("reports an unknown module as impossible", () => {
    const modules = sortedModules([lessonsModule(1, [], 1)]);
    expect(describeModuleMove(modules, 99, "down").possible).toBe(false);
  });
});

describe("describeLessonMove", () => {
  const build = () =>
    sortedModules([
      lessonsModule(1, [lesson(1, 1, 1), lesson(2, 1, 2)], 1),
      mod(2, "qa", [], 2),
      lessonsModule(3, [lesson(3, 3, 1), lesson(4, 3, 2)], 3),
      lessonsModule(4, [lesson(5, 4, 1)], 4),
    ]);

  it("describes a within-module swap with the lesson it would trade places with", () => {
    const info = describeLessonMove(build(), 2, "up");
    expect(info).toMatchObject({
      possible: true,
      kind: "within",
      sourceModuleId: 1,
      targetModuleId: 1,
      swapLessonId: 1,
      slot: null,
    });
  });

  it("describes a cross-module move to the end of the previous content module", () => {
    const info = describeLessonMove(build(), 3, "up");
    expect(info).toMatchObject({
      possible: true,
      kind: "cross",
      sourceModuleId: 3,
      targetModuleId: 1,
      targetModuleName: "Module 1",
      swapLessonId: null,
      slot: "end",
    });
  });

  it("describes a cross-module move to the start of the next content module, skipping Q&A", () => {
    const info = describeLessonMove(build(), 2, "down");
    expect(info).toMatchObject({
      possible: true,
      kind: "cross",
      sourceModuleId: 1,
      targetModuleId: 3,
      targetModuleName: "Module 3",
      slot: "start",
    });
  });

  it("reports impossible moves at the curriculum boundaries", () => {
    expect(describeLessonMove(build(), 1, "up").possible).toBe(false);
    expect(describeLessonMove(build(), 5, "down").possible).toBe(false);
  });

  it("reports unknown lessons as impossible", () => {
    expect(describeLessonMove(build(), 99, "up").possible).toBe(false);
  });
});

describe("moveModule", () => {
  it("moves a module up and renumbers the sequence", () => {
    const modules = sortedModules([lessonsModule(1, [], 1), lessonsModule(2, [], 2), lessonsModule(3, [], 3)]);

    const next = moveModule(modules, 2, "up")!;

    expect(next.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(next.map((m) => m.sequence_order)).toEqual([1, 2, 3]);
  });

  it("moves a module down and renumbers the sequence", () => {
    const modules = sortedModules([lessonsModule(1, [], 1), lessonsModule(2, [], 2), lessonsModule(3, [], 3)]);

    const next = moveModule(modules, 1, "down")!;

    expect(next.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(next.map((m) => m.sequence_order)).toEqual([1, 2, 3]);
  });

  it("returns null when moving past the boundary", () => {
    const modules = sortedModules([lessonsModule(1, [], 1), lessonsModule(2, [], 2)]);
    expect(moveModule(modules, 1, "up")).toBeNull();
    expect(moveModule(modules, 2, "down")).toBeNull();
  });

  it("returns null for an unknown module id", () => {
    const modules = sortedModules([lessonsModule(1, [], 1)]);
    expect(moveModule(modules, 99, "up")).toBeNull();
  });
});

describe("moveModule schedule swap", () => {
  function scheduled(id: number, sequenceOrder: number, start_time: string | null, end_time: string | null): ModuleWithLessons {
    return { ...lessonsModule(id, [], sequenceOrder), start_time, end_time };
  }

  it("trades time sessions with the neighbour it displaced when moving up", () => {
    const modules = sortedModules([
      scheduled(1, 1, "09:00", "10:00"),
      scheduled(2, 2, "10:00", "11:00"),
      scheduled(3, 3, "11:00", "12:00"),
    ]);

    const next = moveModule(modules, 2, "up")!;

    expect(next.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(next.map((m) => m.sequence_order)).toEqual([1, 2, 3]);
    expect(next.find((m) => m.id === 1)).toMatchObject({ start_time: "10:00", end_time: "11:00" });
    expect(next.find((m) => m.id === 2)).toMatchObject({ start_time: "09:00", end_time: "10:00" });
  });

  it("trades time sessions with the neighbour it displaced when moving down", () => {
    const modules = sortedModules([
      scheduled(1, 1, "09:00", "10:00"),
      scheduled(2, 2, "10:00", "11:00"),
      scheduled(3, 3, "11:00", "12:00"),
    ]);

    const next = moveModule(modules, 1, "down")!;

    expect(next.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(next.find((m) => m.id === 1)).toMatchObject({ start_time: "10:00", end_time: "11:00" });
    expect(next.find((m) => m.id === 2)).toMatchObject({ start_time: "09:00", end_time: "10:00" });
  });

  it("keeps the speaker with the module, not the slot", () => {
    const modules = sortedModules([
      { ...scheduled(1, 1, "09:00", "10:00"), speaker_profile_id: 7 },
      { ...scheduled(2, 2, "10:00", "11:00"), speaker_profile_id: null },
    ]);

    const next = moveModule(modules, 2, "up")!;

    expect(next.find((m) => m.id === 1)?.speaker_profile_id).toBe(7);
    expect(next.find((m) => m.id === 2)?.speaker_profile_id).toBeNull();
  });

  it("does not mutate the modules it is given", () => {
    const modules = sortedModules([scheduled(1, 1, "09:00", "10:00"), scheduled(2, 2, "10:00", "11:00")]);
    const before = JSON.stringify(modules);

    moveModule(modules, 2, "up");

    expect(JSON.stringify(modules)).toBe(before);
  });
});

describe("moveLesson within a module", () => {
  const build = () => sortedModules([lessonsModule(1, [lesson(1, 1, 1), lesson(2, 1, 2), lesson(3, 1, 3)], 1)]);

  it("moves a middle lesson up by swapping it with its predecessor", () => {
    const { modules, updates } = moveLesson(build(), 2, "up")!;

    expect(modules[0].LESSONS.map((l) => l.id)).toEqual([2, 1, 3]);
    expect(modules[0].LESSONS.map((l) => l.sequence_order)).toEqual([1, 2, 3]);
    expect(updates.map((u) => u.id).sort()).toEqual([1, 2]);
  });

  it("moves a middle lesson down by swapping it with its successor", () => {
    const { modules, updates } = moveLesson(build(), 2, "down")!;

    expect(modules[0].LESSONS.map((l) => l.id)).toEqual([1, 3, 2]);
    expect(modules[0].LESSONS.map((l) => l.sequence_order)).toEqual([1, 2, 3]);
    expect(updates.map((u) => u.id).sort()).toEqual([2, 3]);
  });

  it("reports only the lessons whose position actually changed", () => {
    const { updates } = moveLesson(build(), 1, "down")!;

    expect(updates.map((u) => u.id).sort()).toEqual([1, 2]);
    expect(updates.every((u) => u.module_id === 1)).toBe(true);
  });

  it("returns null for the first lesson's up and last lesson's down", () => {
    expect(moveLesson(build(), 1, "up")).toBeNull();
    expect(moveLesson(build(), 3, "down")).toBeNull();
  });

  it("returns null for an unknown lesson id", () => {
    expect(moveLesson(build(), 99, "up")).toBeNull();
  });
});

describe("moveLesson across modules", () => {
  const build = () =>
    sortedModules([
      lessonsModule(1, [lesson(1, 1, 1), lesson(2, 1, 2)], 1),
      mod(2, "qa", [], 2),
      lessonsModule(3, [lesson(3, 3, 1), lesson(4, 3, 2)], 3),
      lessonsModule(4, [lesson(5, 4, 1)], 4),
    ]);

  it("appends a module's first lesson to the previous content module on up", () => {
    const { modules, updates } = moveLesson(build(), 3, "up")!;

    const m1 = modules.find((m) => m.id === 1)!;
    const m3 = modules.find((m) => m.id === 3)!;

    expect(m1.LESSONS.map((l) => l.id)).toEqual([1, 2, 3]);
    expect(m1.LESSONS.map((l) => l.sequence_order)).toEqual([1, 2, 3]);
    expect(m3.LESSONS.map((l) => l.id)).toEqual([4]);
    expect(m3.LESSONS[0].sequence_order).toBe(1);

    const moved = updates.find((u) => u.id === 3)!;
    expect(moved.module_id).toBe(1);
    expect(moved.sequence_order).toBe(3);
  });

  it("prepends a module's last lesson to the next content module on down, skipping Q&A modules", () => {
    const { modules, updates } = moveLesson(build(), 2, "down")!;

    const m1 = modules.find((m) => m.id === 1)!;
    const m3 = modules.find((m) => m.id === 3)!;

    expect(m1.LESSONS.map((l) => l.id)).toEqual([1]);
    expect(m3.LESSONS.map((l) => l.id)).toEqual([2, 3, 4]);
    expect(m3.LESSONS.map((l) => l.sequence_order)).toEqual([1, 2, 3]);

    const moved = updates.find((u) => u.id === 2)!;
    expect(moved.module_id).toBe(3);
    expect(moved.sequence_order).toBe(1);
  });

  it("leaves Q&A modules untouched and in place", () => {
    const { modules } = moveLesson(build(), 2, "down")!;

    const qa = modules.find((m) => m.id === 2)!;
    expect(qa.module_type).toBe("qa");
    expect(qa.LESSONS).toEqual([]);
  });

  it("returns null when crossing past the first or last content module", () => {
    expect(moveLesson(build(), 1, "up")).toBeNull();
    expect(moveLesson(build(), 5, "down")).toBeNull();
  });
});
