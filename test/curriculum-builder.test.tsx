// @vitest-environment jsdom
import { useCallback, useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { CurriculumBuilder, type CurriculumBuilderProps } from "@/modules/courses/components/curriculum-builder";
import type { Lesson } from "@/shared/types";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";
import type { LessonMove } from "@/modules/courses/lib/reorder";

function lesson(id: number, moduleId: number, seq: number): Lesson {
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
  };
}

function mod(
  id: number,
  name: string,
  type: "lessons" | "qa",
  lessons: Lesson[],
  seq: number,
  schedule?: { start_time: string | null; end_time: string | null; speaker_profile_id?: number | null },
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
    speaker_profile_id: schedule?.speaker_profile_id ?? null,
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

// Adjacent windows, no overlap: 09:00-10:00 then 10:00-11:00.
const scheduledModules = [
  mod(1, "Module 1", "lessons", [], 1, { start_time: "09:00:00", end_time: "10:00:00" }),
  mod(2, "Module 2", "lessons", [], 2, { start_time: "10:00:00", end_time: "11:00:00" }),
];

const noop = vi.fn();

function renderStatic(overrides: Partial<CurriculumBuilderProps> = {}) {
  return render(
    <CurriculumBuilder
      modules={modules}
      eventSpeakers={[]}
      onUpdateModuleSchedule={async () => null}
      onAddModule={noop}
      onAddQaModule={noop}
      onRenameModule={noop}
      onDeleteModule={noop}
      onDeleteLesson={noop}
      onAddLessonClick={noop}
      onReorderModules={noop}
      onMoveLesson={noop}
      onRenameLesson={noop}
      onUpdateLessonDescription={noop}
      {...overrides}
    />,
  );
}

function openPicker(modName: string) {
  fireEvent.click(screen.getByRole("button", { name: `Session time for ${modName}` }));
}

function startColumn(modName: string) {
  return screen.getByRole("listbox", { name: `Start time for ${modName}` });
}

function endColumn(modName: string) {
  return screen.getByRole("listbox", { name: `End time for ${modName}` });
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
      eventSpeakers={[]}
      onUpdateModuleSchedule={async () => null}
      onAddModule={noop}
      onAddQaModule={noop}
      onRenameModule={noop}
      onDeleteModule={noop}
      onDeleteLesson={noop}
      onAddLessonClick={noop}
      onReorderModules={handleReorder}
      onMoveLesson={handleMove}
      onRenameLesson={noop}
      onUpdateLessonDescription={noop}
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
  vi.unstubAllGlobals();
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

  it("moves a module down with its down arrow", () => {
    const onReorderModules = vi.fn();
    render(<Harness initial={modules} onMoveLesson={noop} onReorderModules={onReorderModules} />);

    fireEvent.click(screen.getByRole("button", { name: "Move module below Q&A" }));

    const next = onReorderModules.mock.calls[0][0] as ModuleWithLessons[];
    expect(next.map((m) => m.id)).toEqual([2, 1, 3]);
    expect(next.map((m) => m.sequence_order)).toEqual([1, 2, 3]);
  });

  it("highlights the target module while previewing a module move", () => {
    renderStatic();

    const upButton = screen.getByRole("button", { name: "Move module above Q&A" });
    fireEvent.mouseEnter(upButton);
    expect(screen.getByText("Q&A Module").closest(".ring-2")).toBeTruthy();

    fireEvent.mouseLeave(upButton);
    expect(screen.getByText("Q&A Module").closest(".ring-2")).toBeNull();
  });
});

describe("CurriculumBuilder module header", () => {
  it("renames a module from the header on Enter", () => {
    const onRenameModule = vi.fn(async () => {});
    renderStatic({ onRenameModule });

    fireEvent.click(screen.getAllByTitle("Rename module")[0]);
    fireEvent.change(screen.getByDisplayValue("Module 1"), { target: { value: "Intro" } });
    fireEvent.keyDown(screen.getByDisplayValue("Intro"), { key: "Enter" });

    expect(onRenameModule).toHaveBeenCalledWith(1, "Intro");
    expect(screen.queryByDisplayValue("Intro")).toBeNull();
  });

  it("cancels a rename on Escape without committing", () => {
    const onRenameModule = vi.fn(async () => {});
    renderStatic({ onRenameModule });

    fireEvent.click(screen.getAllByTitle("Rename module")[0]);
    fireEvent.change(screen.getByDisplayValue("Module 1"), { target: { value: "Intro" } });
    fireEvent.keyDown(screen.getByDisplayValue("Intro"), { key: "Escape" });

    expect(onRenameModule).not.toHaveBeenCalled();
  });
});

describe("CurriculumBuilder schedule editing", () => {
  it("renders a session picker per module, empty when unset", () => {
    renderStatic();

    expect(screen.getAllByRole("button", { name: /Session time for/ })).toHaveLength(modules.length);
    expect(screen.getAllByText("Not scheduled")).toHaveLength(modules.length);
  });

  it("shows committed session times on the header chip", () => {
    renderStatic({ modules: scheduledModules });

    const module1 = screen.getByRole("button", { name: "Session time for Module 1" });
    expect(module1.textContent).toContain("9:00 AM");
    expect(module1.textContent).toContain("10:00 AM");
    expect(screen.getByRole("button", { name: "Session time for Module 2" }).textContent).toContain("11:00 AM");
  });

  it("shows Start and End columns side by side in one open, each with Not scheduled", () => {
    renderStatic();
    openPicker("Module 1");

    expect(startColumn("Module 1")).toBeTruthy();
    expect(endColumn("Module 1")).toBeTruthy();
    expect(within(startColumn("Module 1")).getByRole("option", { name: "Not scheduled" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(within(endColumn("Module 1")).getByRole("option", { name: "Not scheduled" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("offers 15-minute steps bounded to the event window", () => {
    renderStatic({ eventStartTime: "09:00", eventEndTime: "10:00" });
    openPicker("Module 1");

    const start = startColumn("Module 1");
    expect(within(start).getByRole("option", { name: "9:15 AM" })).toBeTruthy();
    expect(within(start).queryByRole("option", { name: "8:45 AM" })).toBeNull();
    expect(within(start).queryByRole("option", { name: "10:15 AM" })).toBeNull();
  });

  it("normalises the DAO's '09:00:00' to '09:00' and preselects both edges", () => {
    renderStatic({ modules: scheduledModules });
    openPicker("Module 1");

    expect(within(startColumn("Module 1")).getByRole("option", { name: "9:00 AM" }).getAttribute("aria-selected")).toBe("true");
    expect(within(endColumn("Module 1")).getByRole("option", { name: "10:00 AM" }).getAttribute("aria-selected")).toBe("true");

    openPicker("Module 2");
    expect(within(startColumn("Module 2")).getByRole("option", { name: "10:00 AM" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(within(endColumn("Module 2")).getByRole("option", { name: "11:00 AM" }).getAttribute("aria-selected")).toBe("true");
  });

  it("commits a pair picked in a single open", async () => {
    const onUpdateModuleSchedule = vi.fn(async () => null);
    renderStatic({ modules: [mod(1, "Module 1", "lessons", [], 1)], onUpdateModuleSchedule });

    openPicker("Module 1");
    fireEvent.click(within(startColumn("Module 1")).getByRole("option", { name: "9:30 AM" }));
    // Half-filled: picking only the start commits nothing yet.
    expect(onUpdateModuleSchedule).not.toHaveBeenCalled();
    fireEvent.click(within(endColumn("Module 1")).getByRole("option", { name: "10:00 AM" }));

    await waitFor(() =>
      expect(onUpdateModuleSchedule).toHaveBeenCalledWith(1, {
        start_time: "09:30",
        end_time: "10:00",
        speaker_profile_id: null,
      }),
    );
  });

  it("keeps the panel open until Done, then closes it", () => {
    renderStatic();
    openPicker("Module 1");
    fireEvent.click(within(startColumn("Module 1")).getByRole("option", { name: "9:30 AM" }));

    expect(screen.getByRole("listbox", { name: "Start time for Module 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("listbox", { name: "Start time for Module 1" })).toBeNull();
  });

  it("closes the picker on outside click and on Escape", () => {
    renderStatic();
    openPicker("Module 1");
    expect(screen.getByRole("listbox", { name: "Start time for Module 1" })).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox", { name: "Start time for Module 1" })).toBeNull();

    openPicker("Module 1");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Start time for Module 1" })).toBeNull();
  });

  it("clears a session when both times are emptied", async () => {
    const onUpdateModuleSchedule = vi.fn(async () => null);
    renderStatic({ modules: scheduledModules, onUpdateModuleSchedule });

    openPicker("Module 1");
    fireEvent.click(within(startColumn("Module 1")).getByRole("option", { name: "Not scheduled" }));
    fireEvent.click(within(endColumn("Module 1")).getByRole("option", { name: "Not scheduled" }));

    await waitFor(() =>
      expect(onUpdateModuleSchedule).toHaveBeenCalledWith(1, {
        start_time: null,
        end_time: null,
        speaker_profile_id: null,
      }),
    );
  });

  it("greys out a start inside another module's window but leaves it clickable", () => {
    renderStatic({ modules: scheduledModules });
    openPicker("Module 2");

    const booked = within(startColumn("Module 2")).getByRole("option", { name: "9:45 AM" });
    expect(booked).toHaveProperty("disabled", false);
    expect(booked.className).toContain("text-muted-fg/60");
    // An adjacent start exactly at Module 1's end stays open.
    expect(within(startColumn("Module 2")).getByRole("option", { name: "10:00 AM" }).className).not.toContain(
      "text-muted-fg/60",
    );
  });

  it("keeps a conflicting start picked and warns without committing", () => {
    // Module 2 has only a start (no end committed); a start that falls inside
    // Module 1's 09:00-10:00 window is greyed but still selectable.
    const onUpdateModuleSchedule = vi.fn(async () => null);
    const startOnly = [
      mod(1, "Module 1", "lessons", [], 1, { start_time: "09:00:00", end_time: "10:00:00" }),
      mod(2, "Module 2", "lessons", [], 2, { start_time: "10:00:00", end_time: null }),
    ];
    renderStatic({ modules: startOnly, onUpdateModuleSchedule });

    openPicker("Module 2");
    fireEvent.click(within(startColumn("Module 2")).getByRole("option", { name: "9:30 AM" }));

    expect(within(startColumn("Module 2")).getByRole("option", { name: "9:30 AM" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Set both times, or leave both unset, to schedule this module.")).toBeTruthy();
    expect(onUpdateModuleSchedule).not.toHaveBeenCalled();
  });

  it("greys out an end at or before the start time", () => {
    renderStatic({ modules: scheduledModules });
    openPicker("Module 2");

    expect(within(endColumn("Module 2")).getByRole("option", { name: "9:00 AM" }).className).toContain("text-muted-fg/60");
    expect(within(endColumn("Module 2")).getByRole("option", { name: "11:00 AM" }).className).not.toContain("text-muted-fg/60");
  });

  it("keeps a committed off-grid time selectable instead of rewriting it", () => {
    const offGrid = [
      mod(1, "Module 1", "lessons", [], 1, { start_time: "09:07:00", end_time: "10:00:00" }),
      mod(2, "Module 2", "lessons", [], 2, { start_time: "10:00:00", end_time: "11:00:00" }),
    ];
    renderStatic({ modules: offGrid });
    openPicker("Module 1");

    const offGridOption = within(startColumn("Module 1")).getByRole("option", { name: "9:07 AM" });
    expect(offGridOption.getAttribute("aria-selected")).toBe("true");
    expect(offGridOption.className).not.toContain("text-muted-fg/60");
  });

  it("flags a pre-existing overlap on the row without committing another edit", async () => {
    const onUpdateModuleSchedule = vi.fn(async () => null);
    const overlapping = [
      mod(1, "Module 1", "lessons", [], 1, { start_time: "09:00:00", end_time: "10:30:00" }),
      mod(2, "Module 2", "lessons", [], 2, { start_time: "10:00:00", end_time: "11:00:00" }),
    ];
    renderStatic({ modules: overlapping, onUpdateModuleSchedule });

    openPicker("Module 2");
    expect(screen.getByText('Overlaps "Module 1" (9:00 AM – 10:30 AM).')).toBeTruthy();

    // Editing the end to a non-conflicting value keeps the overlap in place
    // (the start still clashes), so nothing commits.
    fireEvent.click(within(endColumn("Module 2")).getByRole("option", { name: "12:00 PM" }));
    expect(onUpdateModuleSchedule).not.toHaveBeenCalled();
  });

  it("toasts the API message when the update fails", async () => {
    const onUpdateModuleSchedule = vi.fn(async () => "Module not found");
    renderStatic({ modules: scheduledModules, onUpdateModuleSchedule });

    openPicker("Module 2");
    fireEvent.click(within(startColumn("Module 2")).getByRole("option", { name: "10:30 AM" }));

    expect(await screen.findByText("Could not save schedule")).toBeTruthy();
    expect(screen.getByText("Module not found")).toBeTruthy();
  });

  it("shows a persistent warning banner and icons for pre-existing overlaps", () => {
    const overlapping = [
      mod(1, "Module 1", "lessons", [], 1, { start_time: "09:00:00", end_time: "10:30:00" }),
      mod(2, "Module 2", "lessons", [], 2, { start_time: "10:00:00", end_time: "11:00:00" }),
    ];
    renderStatic({ modules: overlapping });

    expect(screen.getByText(/Fix required/)).toBeTruthy();
    expect(screen.getByText(/"Module 1" and "Module 2"/)).toBeTruthy();
    expect(screen.getAllByTitle("Session overlaps another module")).toHaveLength(2);
  });

  it("hides the speaker select for one speaker and shows it for several", () => {
    const { unmount } = renderStatic({ eventSpeakers: [{ speaker_profile_id: 7, full_name: "Ada Lovelace" }] });
    expect(screen.queryByLabelText(/Speaker for/)).toBeNull();

    unmount();
    renderStatic({
      eventSpeakers: [
        { speaker_profile_id: 7, full_name: "Ada Lovelace" },
        { speaker_profile_id: 9, full_name: "Grace Hopper" },
      ],
    });

    expect(screen.getAllByLabelText(/Speaker for/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: "Unassigned" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: "Grace Hopper" }).length).toBeGreaterThan(0);
  });

  it("commits a speaker assignment through onUpdateModuleSchedule", async () => {
    const onUpdateModuleSchedule = vi.fn(async () => null);
    renderStatic({
      modules: scheduledModules,
      eventSpeakers: [
        { speaker_profile_id: 7, full_name: "Ada Lovelace" },
        { speaker_profile_id: 9, full_name: "Grace Hopper" },
      ],
      onUpdateModuleSchedule,
    });

    fireEvent.change(screen.getByLabelText("Speaker for Module 2"), { target: { value: "9" } });

    await waitFor(() =>
      expect(onUpdateModuleSchedule).toHaveBeenCalledWith(2, {
        start_time: "10:00",
        end_time: "11:00",
        speaker_profile_id: 9,
      }),
    );
  });
});

describe("CurriculumBuilder lesson name", () => {
  it("renders the lesson name as clickable text", () => {
    renderStatic();

    expect(screen.getByText("Lesson 1")).toBeTruthy();
    expect(screen.getByText("Lesson 1").getAttribute("role")).toBe("button");
  });

  it("enters edit mode on click and commits trimmed text on blur", async () => {
    const onRenameLesson = vi.fn(async () => {});
    renderStatic({ onRenameLesson });

    fireEvent.click(screen.getByText("Lesson 1"));
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: " Renamed Lesson " } });
    fireEvent.blur(input);

    await waitFor(() => expect(onRenameLesson).toHaveBeenCalledWith(1, "Renamed Lesson"));
  });

  it("does not call onRenameLesson when the text is unchanged", () => {
    const onRenameLesson = vi.fn(async () => {});
    renderStatic({ onRenameLesson });

    fireEvent.click(screen.getByText("Lesson 1"));
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);

    expect(onRenameLesson).not.toHaveBeenCalled();
  });

  it("cancels edit on Escape without saving", () => {
    const onRenameLesson = vi.fn(async () => {});
    renderStatic({ onRenameLesson });

    fireEvent.click(screen.getByText("Lesson 1"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRenameLesson).not.toHaveBeenCalled();
    expect(screen.getByText("Lesson 1")).toBeTruthy();
  });

  it("enters edit mode from the name pencil and commits trimmed text on blur", async () => {
    const onRenameLesson = vi.fn(async () => {});
    const onUpdateLessonDescription = vi.fn(async () => {});
    renderStatic({ onRenameLesson, onUpdateLessonDescription });

    const row = screen.getByText("Lesson 1").closest("[data-lesson-id]") as HTMLElement;
    fireEvent.click(within(row).getByLabelText("Rename lesson"));
    const input = within(row).getByRole("textbox");
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: " Renamed via pencil " } });
    fireEvent.blur(input);

    await waitFor(() => expect(onRenameLesson).toHaveBeenCalledWith(1, "Renamed via pencil"));
    expect(onUpdateLessonDescription).not.toHaveBeenCalled();
  });
});

describe("CurriculumBuilder lesson description", () => {
  const describedModule = mod(1, "Module 1", "lessons", [{ ...lesson(1, 1, 1), description: "Foundations of prompting" }], 1);
  const emptyDescriptionModule = mod(1, "Module 1", "lessons", [{ ...lesson(5, 1, 1), description: null }], 1);

  it("renders a lesson's description as a muted line", () => {
    renderStatic({ modules: [describedModule] });

    const line = screen.getByText("Foundations of prompting");
    expect(line).toBeTruthy();
    expect(line.className).toContain("text-muted-fg");
  });

  it("renders an Add description placeholder when the description is null", () => {
    renderStatic({ modules: [emptyDescriptionModule] });

    expect(screen.getByText("Add description")).toBeTruthy();
  });

  it("opens the description editor empty from the placeholder", () => {
    renderStatic({ modules: [emptyDescriptionModule] });

    fireEvent.click(screen.getByText("Add description"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("");
  });

  it("commits a trimmed description on blur", async () => {
    const onUpdateLessonDescription = vi.fn(async () => {});
    renderStatic({ modules: [emptyDescriptionModule], onUpdateLessonDescription });

    fireEvent.click(screen.getByText("Add description"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " Workshop notes " } });
    fireEvent.blur(screen.getByRole("textbox"));

    await waitFor(() => expect(onUpdateLessonDescription).toHaveBeenCalledWith(5, "Workshop notes"));
  });

  it("commits an emptied description as null", async () => {
    const onUpdateLessonDescription = vi.fn(async () => {});
    renderStatic({ modules: [describedModule], onUpdateLessonDescription });

    fireEvent.click(screen.getByText("Foundations of prompting"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.blur(screen.getByRole("textbox"));

    await waitFor(() => expect(onUpdateLessonDescription).toHaveBeenCalledWith(1, null));
  });

  it("does not call onUpdateLessonDescription when the description is unchanged", () => {
    const onUpdateLessonDescription = vi.fn(async () => {});
    renderStatic({ modules: [describedModule], onUpdateLessonDescription });

    fireEvent.click(screen.getByText("Foundations of prompting"));
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onUpdateLessonDescription).not.toHaveBeenCalled();
  });

  it("cancels a description edit on Escape without saving", () => {
    const onUpdateLessonDescription = vi.fn(async () => {});
    renderStatic({ modules: [describedModule], onUpdateLessonDescription });

    fireEvent.click(screen.getByText("Foundations of prompting"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onUpdateLessonDescription).not.toHaveBeenCalled();
    expect(screen.getByText("Foundations of prompting")).toBeTruthy();
  });

  it("editing the description never calls onRenameLesson", async () => {
    const onRenameLesson = vi.fn(async () => {});
    const onUpdateLessonDescription = vi.fn(async () => {});
    renderStatic({ modules: [emptyDescriptionModule], onRenameLesson, onUpdateLessonDescription });

    fireEvent.click(screen.getByText("Add description"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Notes" } });
    fireEvent.blur(screen.getByRole("textbox"));

    await waitFor(() => expect(onUpdateLessonDescription).toHaveBeenCalledWith(5, "Notes"));
    expect(onRenameLesson).not.toHaveBeenCalled();
  });
});

describe("CurriculumBuilder lesson row", () => {
  const describedModule = mod(1, "Module 1", "lessons", [{ ...lesson(1, 1, 1), description: "Foundations of prompting" }], 1);

  it("opens the name editor with the name value on Enter", () => {
    renderStatic();

    fireEvent.keyDown(screen.getByText("Lesson 1"), { key: "Enter" });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("Lesson 1");
  });

  it("does not open the name editor on a non-Enter key", () => {
    renderStatic();

    fireEvent.keyDown(screen.getByText("Lesson 1"), { key: "a" });

    expect(screen.queryByRole("textbox")).toBeNull();
  });

  // A database missing the column hands the row a lesson with no name at all,
  // which the `Lesson` type says cannot happen. Opening the editor used to seed
  // it with undefined; blurring straight back out then threw on trim. Typing
  // first hides the bug, because the change event replaces the state.
  const namelessModule = () => {
    const nameless: Partial<Lesson> = lesson(7, 1, 1);
    delete nameless.name;
    return mod(1, "Module 1", "lessons", [nameless as Lesson], 1);
  };

  it("opens the name editor empty for a lesson whose name is absent", () => {
    renderStatic({ modules: [namelessModule()] });

    fireEvent.click(screen.getByLabelText("Rename lesson"));

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("commits an untouched editor for a nameless lesson without throwing", () => {
    const onRenameLesson = vi.fn(async () => {});
    renderStatic({ modules: [namelessModule()], onRenameLesson });

    fireEvent.click(screen.getByLabelText("Rename lesson"));
    fireEvent.blur(screen.getByRole("textbox"));

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onRenameLesson).not.toHaveBeenCalled();
  });

  it("renames a nameless lesson once a name is typed", () => {
    const onRenameLesson = vi.fn(async () => {});
    renderStatic({ modules: [namelessModule()], onRenameLesson });

    fireEvent.click(screen.getByLabelText("Rename lesson"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " Recovered " } });
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onRenameLesson).toHaveBeenCalledWith(7, "Recovered");
  });

  it("opens the description editor with the value on Enter", () => {
    renderStatic({ modules: [describedModule] });

    fireEvent.keyDown(screen.getByText("Foundations of prompting"), { key: "Enter" });

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("Foundations of prompting");
  });

  it("opens the description editor from the description pencil", () => {
    renderStatic({ modules: [describedModule] });

    fireEvent.click(screen.getByLabelText("Edit lesson description"));

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("Foundations of prompting");
  });

  it("ignores a plain key in the editor and still commits on blur", async () => {
    const onRenameLesson = vi.fn(async () => {});
    renderStatic({ onRenameLesson });

    fireEvent.click(screen.getByText("Lesson 1"));
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onRenameLesson).toHaveBeenCalledWith(1, "Renamed"));
  });

  it("opens linked content in a new tab from the row's View button", () => {
    const withLink = mod(1, "Module 1", "lessons", [{ ...lesson(1, 1, 1), content_url: "https://example.com/v" }], 1);
    const open = vi.fn();
    vi.stubGlobal("open", open);
    renderStatic({ modules: [withLink] });

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(open).toHaveBeenCalledWith("https://example.com/v", "_blank");
  });
});

describe("CurriculumBuilder add module", () => {
  it("starts renaming a newly added module and no-ops when the add returns null", async () => {
    const onAddModule = vi.fn(async () => 1);
    renderStatic({ onAddModule });

    fireEvent.click(screen.getByRole("button", { name: /Add module$/ }));
    expect(await screen.findByDisplayValue("New Module")).toBeTruthy();
    expect(onAddModule).toHaveBeenCalledTimes(1);

    cleanup();
    renderStatic();
    fireEvent.click(screen.getByRole("button", { name: /Add module$/ }));
    expect(screen.queryByDisplayValue("New Module")).toBeNull();
  });

  it("starts renaming a newly added Q&A module", async () => {
    const onAddQaModule = vi.fn(async () => 1);
    renderStatic({ onAddQaModule });

    fireEvent.click(screen.getByRole("button", { name: /Add Q&A$/ }));
    expect(await screen.findByDisplayValue("Q&A")).toBeTruthy();
    expect(onAddQaModule).toHaveBeenCalledTimes(1);
  });
});
