// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { CurriculumBuilder, type CurriculumBuilderProps } from "@/modules/courses/components/curriculum-builder";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { ModuleDraft } from "@/modules/courses/lib/module-draft";
import type { LessonMove } from "@/modules/courses/lib/reorder";
import type { Lesson } from "@/shared/types";

function lesson(id: number, moduleId: number, seq: number, overrides: Partial<Lesson> = {}): Lesson {
  return {
    id,
    module_id: moduleId,
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

function mod(
  id: number,
  name: string,
  type: "lessons" | "qa",
  lessons: Lesson[],
  seq: number,
  schedule?: { start_time: string | null; end_time: string | null },
): ModuleWithLessons {
  return {
    id,
    course_id: 1,
    module_name: name,
    sequence_order: seq,
    module_type: type,
    is_locked: false,
    start_time: schedule?.start_time ?? null,
    end_time: schedule?.end_time ?? null,
    speaker_profile_id: null,
    created_at: "",
    updated_at: "",
    LESSONS: lessons,
  };
}

const modules = [
  mod(1, "Module 1", "lessons", [lesson(1, 1, 1), lesson(2, 1, 2)], 1),
  mod(2, "Q&A", "qa", [], 2),
  mod(3, "Module 3", "lessons", [lesson(3, 3, 1)], 3),
];

const noop = vi.fn();

function renderBuilder(overrides: Partial<CurriculumBuilderProps> = {}) {
  return render(
    <CurriculumBuilder
      modules={modules}
      eventSpeakers={[]}
      onAddModule={noop}
      onAddQaModule={noop}
      onDeleteModule={noop}
      onReorderModules={async () => {}}
      onMoveLesson={async () => {}}
      onSaveModule={async () => null}
      {...overrides}
    />,
  );
}

/** Open the first module's editor and hand back its card. */
function openEditor(index = 0): HTMLElement {
  fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/ })[index]);
  return screen.getByLabelText("Module name").closest("div.relative") as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CurriculumBuilder read-only state", () => {
  it("offers an Edit button on every lesson module", () => {
    renderBuilder();

    // Two lesson modules and one Q&A module, all editable.
    expect(screen.getAllByRole("button", { name: /^Edit$/ })).toHaveLength(3);
  });

  it("shows no lesson inputs before Edit is pressed", () => {
    renderBuilder();

    expect(screen.queryByLabelText("Lesson 1.1 name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("renders lesson names as text", () => {
    renderBuilder();

    expect(screen.getByText("Lesson 1")).toBeTruthy();
  });

  it("warns about overlapping sessions", () => {
    renderBuilder({
      modules: [
        mod(1, "A", "lessons", [], 1, { start_time: "09:00:00", end_time: "11:00:00" }),
        mod(2, "B", "lessons", [], 2, { start_time: "10:00:00", end_time: "12:00:00" }),
      ],
    });

    expect(screen.getByText(/overlapping sessions/)).toBeTruthy();
  });

  it("invites the reader to Edit when a module has no lessons", () => {
    renderBuilder({ modules: [mod(1, "Empty", "lessons", [], 1)] });

    expect(screen.getByText(/use Edit to add one/i)).toBeTruthy();
  });
});

describe("CurriculumBuilder edit mode", () => {
  it("opens the module editor with Save and Cancel", () => {
    renderBuilder();
    openEditor();

    expect(screen.getByLabelText("Module name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  // The editor once opened on a hardcoded "New Module" while the API had created
  // "Module N", so a fresh module's editor showed a name it did not have.
  it("opens on the module's saved name", () => {
    renderBuilder();
    openEditor();

    expect((screen.getByLabelText("Module name") as HTMLInputElement).value).toBe("Module 1");
  });

  it("turns the module's lessons into inputs", () => {
    renderBuilder();
    openEditor();

    expect((screen.getByLabelText("Lesson 1.1 name") as HTMLInputElement).value).toBe("Lesson 1");
    expect(screen.getByLabelText("Lesson 1.1 description")).toBeTruthy();
  });

  it("leaves the other modules read-only", () => {
    renderBuilder();
    openEditor();

    // Module 3's lesson stays text while Module 1 is being edited.
    expect(screen.queryByLabelText("Lesson 3.1 name")).toBeNull();
  });

  it("edits only one module at a time", () => {
    renderBuilder();
    openEditor();

    expect(screen.getAllByLabelText("Module name")).toHaveLength(1);
  });

  it("blocks Add module while an editor is open", () => {
    renderBuilder();
    openEditor();

    expect((screen.getByRole("button", { name: /Add module/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Save for a blank module name", () => {
    renderBuilder();
    openEditor();

    fireEvent.change(screen.getByLabelText("Module name"), { target: { value: "   " } });

    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("CurriculumBuilder buffering", () => {
  it("writes nothing until Save is pressed", () => {
    const onSaveModule = vi.fn<(draft: ModuleDraft) => Promise<string | null>>(async () => null);
    renderBuilder({ onSaveModule });
    openEditor();

    fireEvent.change(screen.getByLabelText("Module name"), { target: { value: "Renamed" } });
    fireEvent.change(screen.getByLabelText("Lesson 1.1 name"), { target: { value: "Renamed lesson" } });

    expect(onSaveModule).not.toHaveBeenCalled();
  });

  it("hands the whole draft over on Save", async () => {
    const onSaveModule = vi.fn<(draft: ModuleDraft) => Promise<string | null>>(async () => null);
    renderBuilder({ onSaveModule });
    openEditor();

    fireEvent.change(screen.getByLabelText("Module name"), { target: { value: "Renamed" } });
    fireEvent.change(screen.getByLabelText("Lesson 1.1 description"), { target: { value: "Why it matters" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveModule).toHaveBeenCalledTimes(1));
    const draft = onSaveModule.mock.calls[0][0];
    expect(draft.module_name).toBe("Renamed");
    expect(draft.lessons[0].description).toBe("Why it matters");
  });

  it("discards every change on Cancel", () => {
    const onSaveModule = vi.fn<(draft: ModuleDraft) => Promise<string | null>>(async () => null);
    renderBuilder({ onSaveModule });
    openEditor();

    fireEvent.change(screen.getByLabelText("Module name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSaveModule).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Module name")).toBeNull();
    expect(screen.queryByDisplayValue("Renamed")).toBeNull();
  });

  it("closes the editor once a save succeeds", async () => {
    renderBuilder({ onSaveModule: async () => null });
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByLabelText("Module name")).toBeNull());
  });

  it("keeps the editor open and reports why when a save fails", async () => {
    renderBuilder({ onSaveModule: async () => "Name already used" });
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Name already used")).toBeTruthy());
    expect(screen.getByLabelText("Module name")).toBeTruthy();
  });
});

describe("CurriculumBuilder lesson editing", () => {
  it("adds a lesson to the draft without writing", () => {
    const onSaveModule = vi.fn<(draft: ModuleDraft) => Promise<string | null>>(async () => null);
    renderBuilder({ onSaveModule });
    const card = openEditor();

    fireEvent.click(within(card).getByRole("button", { name: /Add lesson/ }));

    expect(screen.getByLabelText("Lesson 1.3 name")).toBeTruthy();
    expect(onSaveModule).not.toHaveBeenCalled();
  });

  it("removes a lesson from the draft without writing", () => {
    const onSaveModule = vi.fn<(draft: ModuleDraft) => Promise<string | null>>(async () => null);
    renderBuilder({ onSaveModule });
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: "Remove Lesson 1" }));

    expect(screen.queryByDisplayValue("Lesson 1")).toBeNull();
    expect(onSaveModule).not.toHaveBeenCalled();
  });

  it("reorders within the module and renumbers the rows", () => {
    renderBuilder();
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: "Move Lesson 2 up" }));

    expect((screen.getByLabelText("Lesson 1.1 name") as HTMLInputElement).value).toBe("Lesson 2");
  });

  it("cannot move the first lesson up", () => {
    renderBuilder();
    openEditor();

    expect((screen.getByRole("button", { name: "Move Lesson 1 up" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks material for removal without writing", () => {
    const onSaveModule = vi.fn<(draft: ModuleDraft) => Promise<string | null>>(async () => null);
    renderBuilder({
      modules: [mod(1, "Module 1", "lessons", [lesson(1, 1, 1, { content_url: "/api/storage/course_assets/a.pdf" })], 1)],
      onSaveModule,
    });
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: /Remove material/ }));

    expect(onSaveModule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    return waitFor(() => expect(onSaveModule.mock.calls[0][0].lessons[0].dropMaterial).toBe(true));
  });
});

describe("CurriculumBuilder material viewer", () => {
  const withMaterial = [
    mod(1, "Module 1", "lessons", [lesson(1, 1, 1, { content_url: "/api/storage/course_assets/a.pdf" })], 1),
  ];

  it("offers View only when a lesson has material", () => {
    renderBuilder({ modules: [mod(1, "Module 1", "lessons", [lesson(1, 1, 1)], 1)] });

    expect(screen.queryByRole("button", { name: /View/ })).toBeNull();
  });

  it("opens the overlay from View", () => {
    renderBuilder({ modules: withMaterial });

    fireEvent.click(screen.getByRole("button", { name: /View/ }));

    expect(screen.getByRole("button", { name: /Open in new tab/ })).toBeTruthy();
  });
});

describe("CurriculumBuilder cross-module moves", () => {
  it("writes a cross-module move straight through, outside any editor", async () => {
    const onMoveLesson = vi.fn<(modules: ModuleWithLessons[], updates: LessonMove[]) => Promise<void>>(async () => {});
    renderBuilder({ onMoveLesson });

    const select = screen.getByLabelText("Move Lesson 1 to another module");
    fireEvent.change(select, { target: { value: "3" } });

    await waitFor(() => expect(onMoveLesson).toHaveBeenCalledTimes(1));
    const [, updates] = onMoveLesson.mock.calls[0];
    expect(updates).toContainEqual({ id: 1, module_id: 3, sequence_order: 2 });
  });

  it("does not offer the Q&A module as a destination", () => {
    renderBuilder();

    const options = within(screen.getByLabelText("Move Lesson 1 to another module")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Move to…", "Module 3"]);
  });

  it("hides the destination picker while the module is being edited", () => {
    renderBuilder();
    openEditor();

    expect(screen.queryByLabelText("Move Lesson 1 to another module")).toBeNull();
  });
});

describe("CurriculumBuilder module reorder", () => {
  it("reorders modules immediately", async () => {
    const onReorderModules = vi.fn(async () => {});
    // A controlled parent, so the reorder actually re-renders in the new order.
    function Harness() {
      const [current, setCurrent] = useState(modules);
      return (
        <CurriculumBuilder
          modules={current}
          eventSpeakers={[]}
          onAddModule={noop}
          onAddQaModule={noop}
          onDeleteModule={noop}
          onReorderModules={async (next) => {
            setCurrent(next);
            await onReorderModules();
          }}
          onMoveLesson={async () => {}}
          onSaveModule={async () => null}
        />
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("button", { name: /Move module below/ })[0]);

    await waitFor(() => expect(onReorderModules).toHaveBeenCalled());
  });
});
