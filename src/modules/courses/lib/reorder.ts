import type { Lesson } from "@/shared/types";
import type { ModuleWithLessons } from "./types";

export type MoveDirection = "up" | "down";

/** A lesson whose position or module changed, ready to be persisted. */
export interface LessonMove {
  id: number;
  module_id: number;
  sequence_order: number;
}

export interface LessonMoveResult {
  modules: ModuleWithLessons[];
  updates: LessonMove[];
}

/** What moving a module one step would do, without applying it. */
export interface ModuleMoveInfo {
  possible: boolean;
  direction: MoveDirection;
  /** The module it would trade places with. */
  targetModuleId: number | null;
  targetModuleName: string | null;
}

/**
 * What moving a lesson one step would do, without applying it. `within` swaps
 * it with a sibling in the same module; `cross` moves it over a module
 * boundary. Lessons only live in content modules, so a crossing move skips
 * Q&A modules.
 */
export interface LessonMoveInfo {
  possible: boolean;
  direction: MoveDirection;
  kind: "within" | "cross" | "none";
  sourceModuleId: number | null;
  targetModuleId: number | null;
  targetModuleName: string | null;
  /** The lesson it would swap with, for `within` moves. */
  swapLessonId: number | null;
  /** Where it lands in the target module, for `cross` moves. */
  slot: "start" | "end" | null;
}

function noLessonMove(direction: MoveDirection): LessonMoveInfo {
  return {
    possible: false,
    direction,
    kind: "none",
    sourceModuleId: null,
    targetModuleId: null,
    targetModuleName: null,
    swapLessonId: null,
    slot: null,
  };
}

export function describeModuleMove(modules: ModuleWithLessons[], moduleId: number, direction: MoveDirection): ModuleMoveInfo {
  const idx = modules.findIndex((m) => m.id === moduleId);
  const targetIdx = idx === -1 ? -1 : direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= modules.length) {
    return { possible: false, direction, targetModuleId: null, targetModuleName: null };
  }
  return {
    possible: true,
    direction,
    targetModuleId: modules[targetIdx].id,
    targetModuleName: modules[targetIdx].module_name,
  };
}

export function describeLessonMove(modules: ModuleWithLessons[], lessonId: number, direction: MoveDirection): LessonMoveInfo {
  const content = modules.filter((m) => m.module_type !== "qa");
  const fromIdx = content.findIndex((m) => m.LESSONS.some((l) => l.id === lessonId));
  if (fromIdx === -1) return noLessonMove(direction);
  const from = content[fromIdx];
  const lessonIdx = from.LESSONS.findIndex((l) => l.id === lessonId);

  if (direction === "up") {
    if (lessonIdx > 0) {
      return {
        possible: true,
        direction,
        kind: "within",
        sourceModuleId: from.id,
        targetModuleId: from.id,
        targetModuleName: from.module_name,
        swapLessonId: from.LESSONS[lessonIdx - 1].id,
        slot: null,
      };
    }
    if (fromIdx === 0) return noLessonMove(direction);
    const target = content[fromIdx - 1];
    return {
      possible: true,
      direction,
      kind: "cross",
      sourceModuleId: from.id,
      targetModuleId: target.id,
      targetModuleName: target.module_name,
      swapLessonId: null,
      slot: "end",
    };
  }

  if (lessonIdx < from.LESSONS.length - 1) {
    return {
      possible: true,
      direction,
      kind: "within",
      sourceModuleId: from.id,
      targetModuleId: from.id,
      targetModuleName: from.module_name,
      swapLessonId: from.LESSONS[lessonIdx + 1].id,
      slot: null,
    };
  }
  if (fromIdx === content.length - 1) return noLessonMove(direction);
  const target = content[fromIdx + 1];
  return {
    possible: true,
    direction,
    kind: "cross",
    sourceModuleId: from.id,
    targetModuleId: target.id,
    targetModuleName: target.module_name,
    swapLessonId: null,
    slot: "start",
  };
}

export function moveModule(
  modules: ModuleWithLessons[],
  moduleId: number,
  direction: MoveDirection,
): ModuleWithLessons[] | null {
  const idx = modules.findIndex((m) => m.id === moduleId);
  if (idx === -1) return null;

  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= modules.length) return null;

  const next = [...modules];
  const [moved] = next.splice(idx, 1);
  next.splice(target, 0, moved);
  return next.map((m, i) => ({ ...m, sequence_order: i + 1 }));
}

/**
 * Move a lesson one position up or down in the overall lesson order. Lessons
 * only live in content modules, so crossing a boundary skips Q&A modules: the
 * first lesson's "up" appends to the previous content module, the last
 * lesson's "down" prepends to the next one. Only the lessons whose position or
 * module actually changed are returned, so persistence stays a few small
 * PATCHes rather than the whole course.
 */
export function moveLesson(modules: ModuleWithLessons[], lessonId: number, direction: MoveDirection): LessonMoveResult | null {
  const info = describeLessonMove(modules, lessonId, direction);
  if (!info.possible || info.sourceModuleId === null) return null;

  const next = modules.map((m) => ({ ...m, LESSONS: m.LESSONS.map((l) => ({ ...l })) }));
  const source = next.find((m) => m.id === info.sourceModuleId)!;
  const renumber = new Set<number>([source.id]);

  if (info.kind === "within" && info.swapLessonId !== null) {
    const lessonIdx = source.LESSONS.findIndex((l) => l.id === lessonId);
    const swapIdx = source.LESSONS.findIndex((l) => l.id === info.swapLessonId);
    [source.LESSONS[lessonIdx], source.LESSONS[swapIdx]] = [source.LESSONS[swapIdx], source.LESSONS[lessonIdx]];
  } else if (info.kind === "cross" && info.targetModuleId !== null) {
    const target = next.find((m) => m.id === info.targetModuleId)!;
    renumber.add(target.id);
    const lessonIdx = source.LESSONS.findIndex((l) => l.id === lessonId);
    const [moved] = source.LESSONS.splice(lessonIdx, 1);
    moved.module_id = target.id;
    if (info.slot === "start") {
      target.LESSONS.unshift(moved);
    } else {
      target.LESSONS.push(moved);
    }
  } else {
    return null;
  }

  for (const id of renumber) {
    next
      .find((m) => m.id === id)!
      .LESSONS.forEach((l, i) => {
        l.sequence_order = i + 1;
      });
  }

  return { modules: next, updates: diffLessons(modules, next, renumber) };
}

function diffLessons(before: ModuleWithLessons[], after: ModuleWithLessons[], scope: Set<number>): LessonMove[] {
  const beforeById = new Map<number, Lesson>();
  for (const m of before) {
    if (scope.has(m.id)) {
      for (const l of m.LESSONS) beforeById.set(l.id, l);
    }
  }

  const updates: LessonMove[] = [];
  for (const m of after) {
    if (!scope.has(m.id)) continue;
    for (const l of m.LESSONS) {
      const prev = beforeById.get(l.id);
      if (prev && (prev.module_id !== l.module_id || prev.sequence_order !== l.sequence_order)) {
        updates.push({ id: l.id, module_id: l.module_id, sequence_order: l.sequence_order });
      }
    }
  }
  return updates;
}
