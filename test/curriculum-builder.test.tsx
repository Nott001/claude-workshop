// @vitest-environment jsdom
import { useCallback, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CurriculumBuilder } from "@/modules/courses/components/curriculum-builder";
import type { Lesson } from "@/shared/types";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { LessonMove } from "@/modules/courses/lib/reorder";

function lesson(id: number, moduleId: number, seq: number): Lesson {
  return {
    id,
    module_id: moduleId,
    description: `Lesson ${id}`,
    content_type: "pdf",
    content_url: null,
    sequence_order: seq,
    created_at: "",
    updated_at: "",
  };
}

function mod(id: number, name: string, type: "lessons" | "qa", lessons: Lesson[], seq: number): ModuleWithLessons {
  return {
    id,
    course_id: 1,
    module_name: name,
    sequence_order: seq,
    module_type: type,
    is_locked: false,
    start_time: null,
    end_time: null,
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: lessons,
  };
}

// Module 2 is a Q&A module sitting between two content modules, so a crossing
// lesson move must skip it.
const modules = [
  mod(1, "Module 1", "lessons", [lesson(1, 1, 1), lesson(2, 1, 2)], 1),
  mod(2, "Q&A", "qa", [], 2),
  mod(3, "Module 3", "lessons", [lesson(3, 3, 1), lesson(4, 3, 2)], 3),
];

const noop = vi.fn();

function renderStatic() {
  return render(
    <CurriculumBuilder
      modules={modules}
      onAddModule={noop}
      onAddQaModule={noop}
      onRenameModule={noop}
      onDeleteModule={noop}
      onDeleteLesson={noop}
      onAddLessonClick={noop}
      onReorderModules={noop}
      onMoveLesson={noop}
    />,
  );
}

// Controlled by a parent like the real page, so a move actually re-renders the
// curriculum in the new order instead of leaving the fixture untouched.
function Harness({
  initial,
  onMoveLesson,
  onReorderModules,
}: {
  initial: ModuleWithLessons[];
  onMoveLesson: (modules: ModuleWithLessons[], updates: LessonMove[]) => void;
  onReorderModules: (modules: ModuleWithLessons[]) => void;
}) {
  const [state, setState] = useState(initial);
  const handleMove = useCallback(
    (next: ModuleWithLessons[], updates: LessonMove[]) => {
      onMoveLesson(next, updates);
      setState(next);
      return Promise.resolve();
    },
    [onMoveLesson],
  );
  const handleReorder = useCallback(
    (next: ModuleWithLessons[]) => {
      onReorderModules(next);
      setState(next);
      return Promise.resolve();
    },
    [onReorderModules],
  );
  return (
    <CurriculumBuilder
      modules={state}
      onAddModule={noop}
      onAddQaModule={noop}
      onRenameModule={noop}
      onDeleteModule={noop}
      onDeleteLesson={noop}
      onAddLessonClick={noop}
      onReorderModules={handleReorder}
      onMoveLesson={handleMove}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no scrolling implementation; the post-move scroll is a no-op.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("CurriculumBuilder move affordances", () => {
  it("disables moves that would cross the curriculum boundary", () => {
    renderStatic();

    expect(screen.getByRole("button", { name: "Cannot move lesson up" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cannot move lesson down" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cannot move module up" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cannot move module down" })).toHaveProperty("disabled", true);
  });

  it("labels a cross-module arrow with its exact destination", () => {
    renderStatic();

    expect(screen.getByRole("button", { name: 'Move "Lesson 3" to end of Module 1' })).not.toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: 'Move "Lesson 2" to start of Module 3' })).not.toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: 'Move "Lesson 1" down one position' })).not.toHaveProperty("disabled", true);
  });

  it("highlights the landing slot while previewing a cross-module move", () => {
    renderStatic();
    const upButton = screen.getByRole("button", { name: 'Move "Lesson 3" to end of Module 1' });

    fireEvent.mouseEnter(upButton);
    expect(screen.getByText("Drops in as the last lesson")).toBeTruthy();

    fireEvent.mouseLeave(upButton);
    expect(screen.queryByText("Drops in as the last lesson")).toBeNull();
  });

  it("highlights the row a within-module move would swap with", () => {
    renderStatic();
    const downButton = screen.getByRole("button", { name: 'Move "Lesson 1" down one position' });

    fireEvent.mouseEnter(downButton);
    const swapRow = document.querySelector('[data-lesson-id="2"]');
    expect(swapRow?.classList.contains("ring-2")).toBe(true);

    fireEvent.mouseLeave(downButton);
    expect(document.querySelector('[data-lesson-id="2"]')?.classList.contains("ring-2")).toBe(false);
  });

  it("moves a lesson across modules, flashes it, and confirms where it landed", () => {
    const onMoveLesson = vi.fn();
    render(<Harness initial={modules} onMoveLesson={onMoveLesson} onReorderModules={noop} />);

    fireEvent.click(screen.getByRole("button", { name: 'Move "Lesson 3" to end of Module 1' }));

    const [nextModules, updates] = onMoveLesson.mock.calls[0];
    const m1 = (nextModules as ModuleWithLessons[]).find((m) => m.id === 1)!;
    const m3 = (nextModules as ModuleWithLessons[]).find((m) => m.id === 3)!;
    expect(m1.LESSONS.map((l) => l.id)).toEqual([1, 2, 3]);
    expect(m3.LESSONS.map((l) => l.id)).toEqual([4]);
    expect(updates).toContainEqual({ id: 3, module_id: 1, sequence_order: 3 });

    // The reorder re-rendered under the new numbering, and the moved row is
    // highlighted so the change registers.
    expect(screen.getByText("1.3")).toBeTruthy();
    expect(document.querySelector('[data-lesson-id="3"]')?.classList.contains("curriculum-flash")).toBe(true);

    // Cross-module moves announce the destination so it is never in doubt.
    expect(screen.getByText("Lesson moved to Module 1")).toBeTruthy();
  });

  it("moves a module and renumbers the sequence", () => {
    const onReorderModules = vi.fn();
    render(<Harness initial={modules} onMoveLesson={noop} onReorderModules={onReorderModules} />);

    fireEvent.click(screen.getByRole("button", { name: "Move module above Q&A" }));

    const next = onReorderModules.mock.calls[0][0] as ModuleWithLessons[];
    expect(next.map((m) => m.id)).toEqual([1, 3, 2]);
    expect(next.map((m) => m.sequence_order)).toEqual([1, 2, 3]);
  });
});
