import { describe, it, expect } from "vitest";
import {
  createDraft,
  draftLesson,
  moveDraftLesson,
  planDraft,
  planIsEmpty,
  removeDraftLesson,
  updateDraftLesson,
} from "@/modules/courses/lib/module-draft";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { Lesson } from "@/shared/types";

function lesson(id: number, seq: number, overrides: Partial<Lesson> = {}): Lesson {
  return {
    id,
    module_id: 1,
    name: `Lesson ${id}`,
    description: null,
    content_type: "pdf",
    content_url: null,
    sequence_order: seq,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function mod(overrides: Partial<ModuleWithLessons> = {}): ModuleWithLessons {
  return {
    id: 1,
    course_id: 1,
    module_name: "Foundations",
    sequence_order: 1,
    module_type: "lessons",
    is_locked: false,
    start_time: "09:00:00",
    end_time: "10:00:00",
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: [lesson(1, 1), lesson(2, 2)],
    ...overrides,
  };
}

describe("createDraft", () => {
  it("trims the DAO's HH:MM:SS down to the HH:MM every schema speaks", () => {
    const draft = createDraft(mod());

    expect(draft.start_time).toBe("09:00");
    expect(draft.end_time).toBe("10:00");
  });

  it("carries an unscheduled module across as null rather than an empty string", () => {
    const draft = createDraft(mod({ start_time: null, end_time: null }));

    expect(draft.start_time).toBeNull();
    expect(draft.end_time).toBeNull();
  });
});

describe("planDraft", () => {
  it("plans nothing for an untouched draft", () => {
    const source = mod();
    const plan = planDraft(source, createDraft(source));

    expect(planIsEmpty(plan)).toBe(true);
  });

  it("plans nothing when an edit is typed and then undone", () => {
    const source = mod();
    let draft = createDraft(source);
    draft = { ...draft, module_name: "Renamed" };
    draft = { ...draft, module_name: "Foundations" };

    expect(planIsEmpty(planDraft(source, draft))).toBe(true);
  });

  it("patches the module when the name changes", () => {
    const source = mod();
    const plan = planDraft(source, { ...createDraft(source), module_name: "Basics" });

    expect(plan.modulePatch?.module_name).toBe("Basics");
  });

  it("patches the module when only the speaker changes", () => {
    const source = mod();
    const plan = planDraft(source, { ...createDraft(source), speaker_profile_id: 7 });

    expect(plan.modulePatch?.speaker_profile_id).toBe(7);
  });

  it("creates a lesson that has no id yet, numbered by its position", () => {
    const source = mod();
    const draft = createDraft(source);
    const plan = planDraft(source, {
      ...draft,
      lessons: [...draft.lessons, draftLesson({ name: "  Intro  ", content_type: "link" })],
    });

    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0].name).toBe("Intro");
    expect(plan.creates[0].sequence_order).toBe(3);
  });

  it("deletes a lesson dropped from the draft", () => {
    const source = mod();
    const draft = removeDraftLesson(createDraft(source), "lesson-1");
    const plan = planDraft(source, draft);

    expect(plan.deletes).toEqual([1]);
  });

  it("renumbers the survivors after a delete", () => {
    const source = mod();
    const plan = planDraft(source, removeDraftLesson(createDraft(source), "lesson-1"));

    expect(plan.updates).toEqual([expect.objectContaining({ id: 2, sequence_order: 1 })]);
  });

  it("updates both lessons a reorder swapped", () => {
    const source = mod();
    const plan = planDraft(source, moveDraftLesson(createDraft(source), "lesson-2", "up"));

    expect(plan.updates.map((u) => [u.id, u.sequence_order])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it("does not update a lesson whose only change was typed and undone", () => {
    const source = mod();
    let draft = updateDraftLesson(createDraft(source), "lesson-1", { name: "Changed" });
    draft = updateDraftLesson(draft, "lesson-1", { name: "Lesson 1" });

    expect(planDraft(source, draft).updates).toHaveLength(0);
  });

  it("drops material only for a lesson that actually has some stored", () => {
    const source = mod({ LESSONS: [lesson(1, 1, { content_url: "/api/storage/course_assets/a.pdf" }), lesson(2, 2)] });
    let draft = updateDraftLesson(createDraft(source), "lesson-1", { dropMaterial: true });
    draft = updateDraftLesson(draft, "lesson-2", { dropMaterial: true });

    expect(planDraft(source, draft).materialDrops).toEqual([1]);
  });

  it("queues an upload against the lesson id for a replacement file", () => {
    const source = mod();
    const file = new File(["x"], "slides.pdf", { type: "application/pdf" });
    const draft = updateDraftLesson(createDraft(source), "lesson-1", { pendingFile: file });

    expect(planDraft(source, draft).uploads).toEqual([{ lessonId: 1, file }]);
  });

  it("carries a new lesson's file on the create, since its id does not exist yet", () => {
    const source = mod();
    const draft = createDraft(source);
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    const plan = planDraft(source, {
      ...draft,
      lessons: [...draft.lessons, draftLesson({ name: "Clip", content_type: "video", pendingFile: file })],
    });

    expect(plan.uploads).toHaveLength(0);
    expect(plan.creates[0].pendingFile).toBe(file);
  });
});

describe("moveDraftLesson", () => {
  it("leaves the order alone at the top", () => {
    const draft = createDraft(mod());

    expect(moveDraftLesson(draft, "lesson-1", "up").lessons.map((l) => l.id)).toEqual([1, 2]);
  });

  it("leaves the order alone at the bottom", () => {
    const draft = createDraft(mod());

    expect(moveDraftLesson(draft, "lesson-2", "down").lessons.map((l) => l.id)).toEqual([1, 2]);
  });
});
