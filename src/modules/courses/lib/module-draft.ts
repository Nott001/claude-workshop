import type { ContentType } from "@/shared/types";
import type { ModuleWithLessons } from "./types";

/**
 * A module being edited holds every change locally until Save, so the draft is
 * the editable copy and the module prop stays the last saved truth. Diffing the
 * two at save time is what lets one click become one batch of writes — and what
 * lets Cancel be free.
 */
export interface DraftLesson {
  /** Null until Save creates the row. */
  id: number | null;
  /** React key: a lesson that does not exist yet has no id to key on. */
  key: string;
  name: string;
  description: string | null;
  content_type: ContentType;
  content_url: string | null;
  /** Picked, not yet sent. Uploads post against a lesson id, which Save mints. */
  pendingFile: File | null;
  /** Detach on save, deleting the stored object behind it. */
  dropMaterial: boolean;
}

export interface ModuleDraft {
  moduleId: number;
  module_name: string;
  /** "HH:MM", the form the API validates — not the DAO's "HH:MM:SS". */
  start_time: string | null;
  end_time: string | null;
  speaker_profile_id: number | null;
  lessons: DraftLesson[];
}

export interface ModulePatch {
  module_name: string;
  start_time: string | null;
  end_time: string | null;
  speaker_profile_id: number | null;
}

export interface LessonCreate {
  key: string;
  name: string;
  description: string | null;
  content_type: ContentType;
  content_url: string | null;
  sequence_order: number;
  pendingFile: File | null;
}

export interface LessonUpdate {
  id: number;
  name: string;
  description: string | null;
  content_type: ContentType;
  sequence_order: number;
}

export interface DraftPlan {
  modulePatch: ModulePatch | null;
  creates: LessonCreate[];
  updates: LessonUpdate[];
  deletes: number[];
  /** Existing lessons whose stored material is being detached. */
  materialDrops: number[];
  /** Existing lessons receiving a replacement file. */
  uploads: { lessonId: number; file: File }[];
}

/** The DAO hands back "HH:MM:SS"; every form and every schema speaks "HH:MM". */
function toClockTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

let keySeed = 0;

/** Unique within a session, which is all a React key has to be. */
export function nextDraftKey(): string {
  keySeed += 1;
  return `draft-${keySeed}`;
}

export function createDraft(mod: ModuleWithLessons): ModuleDraft {
  return {
    moduleId: mod.id,
    module_name: mod.module_name,
    start_time: toClockTime(mod.start_time),
    end_time: toClockTime(mod.end_time),
    speaker_profile_id: mod.speaker_profile_id,
    lessons: mod.LESSONS.map((lesson) => ({
      id: lesson.id,
      key: `lesson-${lesson.id}`,
      name: lesson.name ?? "",
      description: lesson.description,
      content_type: lesson.content_type,
      content_url: lesson.content_url,
      pendingFile: null,
      dropMaterial: false,
    })),
  };
}

export function draftLesson(fields: {
  name: string;
  description?: string | null;
  content_type: ContentType;
  content_url?: string | null;
  pendingFile?: File | null;
}): DraftLesson {
  return {
    id: null,
    key: nextDraftKey(),
    name: fields.name,
    description: fields.description ?? null,
    content_type: fields.content_type,
    content_url: fields.content_url ?? null,
    pendingFile: fields.pendingFile ?? null,
    dropMaterial: false,
  };
}

export function updateDraftLesson(
  draft: ModuleDraft,
  key: string,
  changes: Partial<Omit<DraftLesson, "id" | "key">>,
): ModuleDraft {
  return {
    ...draft,
    lessons: draft.lessons.map((lesson) => (lesson.key === key ? { ...lesson, ...changes } : lesson)),
  };
}

export function removeDraftLesson(draft: ModuleDraft, key: string): ModuleDraft {
  return { ...draft, lessons: draft.lessons.filter((lesson) => lesson.key !== key) };
}

/**
 * Reorder inside the draft only. A lesson cannot cross into another module
 * while editing: the destination has not opted into an edit, and moving one
 * there would write to a module the reader never opened.
 */
export function moveDraftLesson(draft: ModuleDraft, key: string, direction: "up" | "down"): ModuleDraft {
  const index = draft.lessons.findIndex((lesson) => lesson.key === key);
  if (index === -1) return draft;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= draft.lessons.length) return draft;

  const lessons = [...draft.lessons];
  [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
  return { ...draft, lessons };
}

function scheduleChanged(mod: ModuleWithLessons, draft: ModuleDraft): boolean {
  return (
    toClockTime(mod.start_time) !== draft.start_time ||
    toClockTime(mod.end_time) !== draft.end_time ||
    mod.speaker_profile_id !== draft.speaker_profile_id
  );
}

/**
 * The whole point of the draft: what actually has to be written. Anything the
 * reader typed and then undid produces no operation, so a Save that changed
 * nothing costs no requests.
 */
export function planDraft(mod: ModuleWithLessons, draft: ModuleDraft): DraftPlan {
  const originals = new Map(mod.LESSONS.map((lesson) => [lesson.id, lesson]));
  const survivingIds = new Set(draft.lessons.map((lesson) => lesson.id).filter((id): id is number => id !== null));

  const plan: DraftPlan = {
    modulePatch:
      mod.module_name !== draft.module_name || scheduleChanged(mod, draft)
        ? {
            module_name: draft.module_name,
            start_time: draft.start_time,
            end_time: draft.end_time,
            speaker_profile_id: draft.speaker_profile_id,
          }
        : null,
    creates: [],
    updates: [],
    deletes: mod.LESSONS.filter((lesson) => !survivingIds.has(lesson.id)).map((lesson) => lesson.id),
    materialDrops: [],
    uploads: [],
  };

  draft.lessons.forEach((lesson, index) => {
    const sequence_order = index + 1;

    if (lesson.id === null) {
      plan.creates.push({
        key: lesson.key,
        name: lesson.name.trim(),
        description: lesson.description,
        content_type: lesson.content_type,
        content_url: lesson.content_url,
        sequence_order,
        pendingFile: lesson.pendingFile,
      });
      return;
    }

    const original = originals.get(lesson.id);
    if (!original) return;

    // Dropping runs before uploading, so a lesson can lose one file and gain
    // another in a single save without the drop erasing the new url.
    if (lesson.dropMaterial && original.content_url) plan.materialDrops.push(lesson.id);
    if (lesson.pendingFile) plan.uploads.push({ lessonId: lesson.id, file: lesson.pendingFile });

    const name = lesson.name.trim();
    const changed =
      name !== original.name ||
      lesson.description !== original.description ||
      lesson.content_type !== original.content_type ||
      sequence_order !== original.sequence_order;

    if (changed) {
      plan.updates.push({
        id: lesson.id,
        name,
        description: lesson.description,
        content_type: lesson.content_type,
        sequence_order,
      });
    }
  });

  return plan;
}

/** Whether a save would write anything at all. */
export function planIsEmpty(plan: DraftPlan): boolean {
  return (
    plan.modulePatch === null &&
    plan.creates.length === 0 &&
    plan.updates.length === 0 &&
    plan.deletes.length === 0 &&
    plan.materialDrops.length === 0 &&
    plan.uploads.length === 0
  );
}
