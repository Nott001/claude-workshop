"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/button";
import { Toast } from "@/shared/components/toast";
import { cn } from "@/shared/lib/utils";
import type { Lesson } from "@/shared/types";
import { findTimeOverlaps } from "../lib/scheduling";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import {
  describeLessonMove,
  describeModuleMove,
  moveLesson,
  moveModule,
  type LessonMoveInfo,
  type LessonMove,
  type ModuleMoveInfo,
  type MoveDirection,
} from "../lib/reorder";

export interface CurriculumBuilderProps {
  modules: ModuleWithLessons[];
  eventSpeakers: CourseSpeaker[];
  onUpdateModuleSchedule: (
    moduleId: number,
    patch: { start_time: string | null; end_time: string | null; speaker_profile_id: number | null },
  ) => Promise<string | null>;
  onAddModule: () => Promise<number | undefined> | number | undefined;
  onAddQaModule: () => Promise<number | undefined> | number | undefined;
  onRenameModule: (moduleId: number, newName: string) => Promise<void> | void;
  onDeleteModule: (moduleId: number) => Promise<void> | void;
  onDeleteLesson: (lessonId: number, moduleId: number) => Promise<void> | void;
  onAddLessonClick: (moduleId: number) => void;
  onReorderModules: (modules: ModuleWithLessons[]) => Promise<void>;
  onMoveLesson: (modules: ModuleWithLessons[], updates: LessonMove[]) => Promise<void>;
}

export type SchedulePatch = { start_time: string | null; end_time: string | null; speaker_profile_id: number | null };

type PreviewState = { type: "module" | "lesson"; id: number; direction: MoveDirection } | null;

interface MoveButtonProps {
  direction: MoveDirection;
  label: string;
  disabled?: boolean;
  onPreview: () => void;
  onPreviewEnd: () => void;
  onClick: () => void;
}

function MoveButton({ direction, label, disabled = false, onPreview, onPreviewEnd, onClick }: MoveButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseEnter={onPreview}
      onMouseLeave={onPreviewEnd}
      onFocus={onPreview}
      onBlur={onPreviewEnd}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-fg transition-colors",
        "hover:border-brand hover:bg-brand/5 hover:text-brand",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-fg",
      )}
    >
      <span className="material-symbols-rounded text-[14px]">
        {direction === "up" ? "keyboard_arrow_up" : "keyboard_arrow_down"}
      </span>
    </button>
  );
}

function lessonMoveLabel(lesson: Lesson, info: LessonMoveInfo): string {
  if (!info.possible) {
    return `Cannot move lesson ${info.direction}`;
  }
  if (info.kind === "within") {
    return `Move "${lesson.description}" ${info.direction} one position`;
  }
  return info.direction === "up"
    ? `Move "${lesson.description}" to end of ${info.targetModuleName}`
    : `Move "${lesson.description}" to start of ${info.targetModuleName}`;
}

function moduleMoveLabel(info: ModuleMoveInfo): string {
  if (!info.possible) {
    return `Cannot move module ${info.direction}`;
  }
  return info.direction === "up" ? `Move module above ${info.targetModuleName}` : `Move module below ${info.targetModuleName}`;
}

// The DAO returns TIME columns as "09:00:00"; the time input wants "09:00".
function toInputTime(time: string | null): string {
  return time ? time.slice(0, 5) : "";
}

interface ScheduleRowProps {
  mod: ModuleWithLessons;
  eventSpeakers: CourseSpeaker[];
  startValue: string;
  endValue: string;
  onTimeChange: (field: "start" | "end", value: string) => void;
  onSpeakerChange: (speakerProfileId: number | null) => void;
}

function ScheduleRow({ mod, eventSpeakers, startValue, endValue, onTimeChange, onSpeakerChange }: ScheduleRowProps) {
  const inputClass =
    "rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-brand focus:ring-2 focus:ring-ring/20";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/70 px-3 py-2">
      <span className="material-symbols-rounded text-[14px] text-muted-fg" title="Session time">
        schedule
      </span>
      <input
        type="time"
        value={startValue}
        onChange={(e) => onTimeChange("start", e.target.value)}
        aria-label={`Start time for ${mod.module_name}`}
        className={inputClass}
      />
      <span className="text-xs text-muted-fg">to</span>
      <input
        type="time"
        value={endValue}
        onChange={(e) => onTimeChange("end", e.target.value)}
        aria-label={`End time for ${mod.module_name}`}
        className={inputClass}
      />
      {eventSpeakers.length > 1 && (
        <select
          value={mod.speaker_profile_id ?? ""}
          onChange={(e) => onSpeakerChange(e.target.value === "" ? null : Number(e.target.value))}
          aria-label={`Speaker for ${mod.module_name}`}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {eventSpeakers.map((speaker) => (
            <option key={speaker.speaker_profile_id} value={speaker.speaker_profile_id}>
              {speaker.full_name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function CurriculumBuilder({
  modules,
  eventSpeakers,
  onUpdateModuleSchedule,
  onAddModule,
  onAddQaModule,
  onRenameModule,
  onDeleteModule,
  onDeleteLesson,
  onAddLessonClick,
  onReorderModules,
  onMoveLesson,
}: CurriculumBuilderProps) {
  const [renamingModuleId, setRenamingModuleId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // A session needs both times, but the two inputs change one at a time; hold
  // the partial pair locally so the edited input survives until its partner
  // arrives, then commit the whole pair together.
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<number, { start: string; end: string }>>({});

  const [preview, setPreview] = useState<PreviewState>(null);
  const [flash, setFlash] = useState<{ lessons: number[]; modules: number[] }>({ lessons: [], modules: [] });
  const flashTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);

  const lessonPreviewInfo = preview?.type === "lesson" ? describeLessonMove(modules, preview.id, preview.direction) : null;
  const modulePreviewInfo = preview?.type === "module" ? describeModuleMove(modules, preview.id, preview.direction) : null;

  useEffect(() => {
    if (renamingModuleId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingModuleId]);

  function flashRows(lessons: number[], moduleIds: number[]) {
    setFlash({ lessons, modules: moduleIds });
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash({ lessons: [], modules: [] }), 1000);
  }

  function scrollLessonIntoView(lessonId: number) {
    window.setTimeout(() => {
      document.querySelector(`[data-lesson-id="${lessonId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  async function handleAddModuleClick() {
    const newModuleId = await onAddModule();
    if (newModuleId != null) {
      setRenamingModuleId(newModuleId);
      setRenameValue("New Module");
    }
  }

  async function handleAddQaModuleClick() {
    const newModuleId = await onAddQaModule();
    if (newModuleId != null) {
      setRenamingModuleId(newModuleId);
      setRenameValue("Q&A");
    }
  }

  function handleMoveModule(moduleId: number, direction: MoveDirection) {
    const info = describeModuleMove(modules, moduleId, direction);
    if (!info.possible) return;
    const next = moveModule(modules, moduleId, direction);
    if (!next) return;
    void onReorderModules(next);
    setPreview(null);
    flashRows([], [moduleId]);
  }

  function handleMoveLesson(lesson: Lesson, direction: MoveDirection) {
    const info = describeLessonMove(modules, lesson.id, direction);
    if (!info.possible) return;
    const next = moveLesson(modules, lesson.id, direction);
    if (!next) return;
    void onMoveLesson(next.modules, next.updates);
    setPreview(null);

    if (info.kind === "within" && info.swapLessonId !== null) {
      flashRows([lesson.id, info.swapLessonId], []);
    } else {
      flashRows([lesson.id], []);
    }

    if (info.kind === "cross" && info.targetModuleName) {
      setToast({
        title: `Lesson moved to ${info.targetModuleName}`,
        description: `It is now the ${info.slot === "start" ? "first" : "last"} lesson in that module.`,
      });
      scrollLessonIntoView(lesson.id);
    }
  }

  const overlaps = findTimeOverlaps(modules);
  const conflictingModuleIds = new Set(overlaps.flatMap(([a, b]) => [a.id, b.id]));

  function draftFor(mod: ModuleWithLessons): { start: string; end: string } {
    return scheduleDrafts[mod.id] ?? { start: toInputTime(mod.start_time), end: toInputTime(mod.end_time) };
  }

  function dropDraft(moduleId: number) {
    setScheduleDrafts((prev) => {
      if (!(moduleId in prev)) return prev;
      const next = { ...prev };
      delete next[moduleId];
      return next;
    });
  }

  async function commitSchedule(mod: ModuleWithLessons, patch: SchedulePatch) {
    const error = await onUpdateModuleSchedule(mod.id, patch);
    dropDraft(mod.id);
    if (error) {
      setToast({ title: "Could not save schedule", description: error });
    }
  }

  async function handleTimeChange(mod: ModuleWithLessons, field: "start" | "end", value: string) {
    const next = { ...draftFor(mod), [field]: value };
    setScheduleDrafts((prev) => ({ ...prev, [mod.id]: next }));

    const start = next.start === "" ? null : next.start;
    const end = next.end === "" ? null : next.end;
    if (start === null && end === null) {
      await commitSchedule(mod, { start_time: null, end_time: null, speaker_profile_id: mod.speaker_profile_id });
      return;
    }
    if (start === null || end === null) return;
    if (end <= start) {
      dropDraft(mod.id);
      setToast({ title: "Invalid time", description: "The end time must be after the start time." });
      return;
    }

    const proposed = modules.map((m) => (m.id === mod.id ? { ...m, start_time: start, end_time: end } : m));
    const conflict = findTimeOverlaps(proposed).find(([a, b]) => a.id === mod.id || b.id === mod.id);
    if (conflict) {
      const other = conflict[0].id === mod.id ? conflict[1] : conflict[0];
      dropDraft(mod.id);
      setToast({ title: "Time conflict", description: `"${other.module_name}" already runs at that time.` });
      return;
    }

    await commitSchedule(mod, { start_time: start, end_time: end, speaker_profile_id: mod.speaker_profile_id });
  }

  async function handleSpeakerChange(mod: ModuleWithLessons, speakerProfileId: number | null) {
    // The props carry the DAO's "HH:MM:SS"; the API validates "HH:MM".
    const error = await onUpdateModuleSchedule(mod.id, {
      start_time: mod.start_time?.slice(0, 5) ?? null,
      end_time: mod.end_time?.slice(0, 5) ?? null,
      speaker_profile_id: speakerProfileId,
    });
    if (error) {
      setToast({ title: "Could not assign speaker", description: error });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="rounded-lg bg-info/10 p-2">
          <span className="material-symbols-rounded text-[20px] text-brand">school</span>
        </div>
        <span className="text-xs font-bold tracking-[0.1em] text-fg">CURRICULUM</span>
      </div>

      <div className="mb-6 mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-fg">Organize your course into modules and lessons.</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleAddQaModuleClick}>
            <span className="material-symbols-rounded text-[14px]">forum</span>
            Add Q&A
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAddModuleClick}>
            <span className="material-symbols-rounded text-[14px]">add_circle</span>
            Add module
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
          <span className="material-symbols-rounded mb-2 block text-[32px] text-muted-fg">post_add</span>
          <p className="text-sm text-muted-fg">No modules yet. Add your first module to start building the curriculum.</p>
        </div>
      ) : (
        <>
          {overlaps.length > 0 && (
            <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              <span className="material-symbols-rounded text-[18px]">warning</span>
              <span>
                Fix required — overlapping sessions:{" "}
                {overlaps.map(([a, b]) => `"${a.module_name}" and "${b.module_name}"`).join(", ")}.
              </span>
            </div>
          )}
          <div className="space-y-3">
            {modules.map((mod) => {
              const isQa = mod.module_type === "qa";
              const upInfo = describeModuleMove(modules, mod.id, "up");
              const downInfo = describeModuleMove(modules, mod.id, "down");
              const isModuleMoveSource = preview?.type === "module" && preview.id === mod.id;
              const isModuleSwapTarget = modulePreviewInfo?.possible === true && modulePreviewInfo.targetModuleId === mod.id;
              const isModuleFlash = flash.modules.includes(mod.id);
              const dropSlot =
                lessonPreviewInfo?.kind === "cross" && lessonPreviewInfo.targetModuleId === mod.id
                  ? lessonPreviewInfo.slot
                  : null;
              const header = (
                <div className="flex items-center gap-2">
                  <span className={cn("material-symbols-rounded text-lg", isQa ? "text-warning" : "text-info")}>
                    {isQa ? "forum" : "menu_book"}
                  </span>
                  {renamingModuleId === mod.id ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameModule(mod.id, renameValue.trim());
                          setRenamingModuleId(null);
                        }
                        if (e.key === "Escape") setRenamingModuleId(null);
                      }}
                      onBlur={() => {
                        if (renameValue.trim()) {
                          onRenameModule(mod.id, renameValue.trim());
                        }
                        setRenamingModuleId(null);
                      }}
                      className="rounded-lg border border-brand bg-surface px-3 py-1.5 text-sm font-semibold text-fg outline-none ring-2 ring-ring/20"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-fg">{mod.module_name}</span>
                  )}

                  <button
                    onClick={() => {
                      setRenamingModuleId(mod.id);
                      setRenameValue(mod.module_name);
                    }}
                    className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
                    title="Rename module"
                  >
                    <span className="material-symbols-rounded text-[14px]">edit</span>
                  </button>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isQa ? "bg-warning/10 text-warning" : "bg-info/10 text-info",
                    )}
                  >
                    {isQa ? "Q&A Module" : `${mod.LESSONS.length} ${mod.LESSONS.length === 1 ? "lesson" : "lessons"}`}
                  </span>

                  {conflictingModuleIds.has(mod.id) && (
                    <span className="material-symbols-rounded text-[16px] text-warning" title="Session overlaps another module">
                      warning
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-1">
                    <MoveButton
                      direction="up"
                      label={moduleMoveLabel(upInfo)}
                      disabled={!upInfo.possible}
                      onPreview={() => setPreview({ type: "module", id: mod.id, direction: "up" })}
                      onPreviewEnd={() => setPreview(null)}
                      onClick={() => handleMoveModule(mod.id, "up")}
                    />
                    <MoveButton
                      direction="down"
                      label={moduleMoveLabel(downInfo)}
                      disabled={!downInfo.possible}
                      onPreview={() => setPreview({ type: "module", id: mod.id, direction: "down" })}
                      onPreviewEnd={() => setPreview(null)}
                      onClick={() => handleMoveModule(mod.id, "down")}
                    />
                    <button
                      onClick={() => onDeleteModule(mod.id)}
                      className="rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
                      title="Delete module"
                    >
                      <span className="material-symbols-rounded text-[14px]">delete</span>
                    </button>
                  </div>
                </div>
              );

              if (isQa) {
                return (
                  <div
                    key={mod.id}
                    className={cn(
                      "rounded-lg border border-warning/30 bg-warning/5 p-5",
                      isModuleSwapTarget && "ring-2 ring-brand/50",
                      isModuleFlash && "curriculum-flash",
                    )}
                  >
                    {header}
                    <ScheduleRow
                      mod={mod}
                      eventSpeakers={eventSpeakers}
                      startValue={draftFor(mod).start}
                      endValue={draftFor(mod).end}
                      onTimeChange={(field, value) => handleTimeChange(mod, field, value)}
                      onSpeakerChange={(speakerProfileId) => handleSpeakerChange(mod, speakerProfileId)}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={mod.id}
                  className={cn(
                    "relative rounded-lg border border-border bg-muted p-5",
                    (isModuleSwapTarget || dropSlot !== null) && "border-brand/60 ring-2 ring-brand/40",
                    isModuleMoveSource && "bg-brand/5",
                    isModuleFlash && "curriculum-flash",
                  )}
                >
                  <div className="mb-3">{header}</div>
                  <ScheduleRow
                    mod={mod}
                    eventSpeakers={eventSpeakers}
                    startValue={draftFor(mod).start}
                    endValue={draftFor(mod).end}
                    onTimeChange={(field, value) => handleTimeChange(mod, field, value)}
                    onSpeakerChange={(speakerProfileId) => handleSpeakerChange(mod, speakerProfileId)}
                  />

                  {dropSlot !== null && (
                    <div
                      className={cn(
                        "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand/60 bg-surface px-3 py-1 text-[11px] font-semibold text-brand shadow-md",
                        dropSlot === "start" ? "-top-3" : "-bottom-3",
                      )}
                    >
                      <span className="material-symbols-rounded mr-1 align-middle text-[12px]">
                        {dropSlot === "start" ? "vertical_align_top" : "vertical_align_bottom"}
                      </span>
                      Drops in as the {dropSlot === "start" ? "first" : "last"} lesson
                    </div>
                  )}

                  {mod.LESSONS.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {mod.LESSONS.map((lesson) => {
                        const upMove = describeLessonMove(modules, lesson.id, "up");
                        const downMove = describeLessonMove(modules, lesson.id, "down");
                        const isLessonSource = preview?.type === "lesson" && preview.id === lesson.id;
                        const isSwapTarget =
                          lessonPreviewInfo?.kind === "within" && lessonPreviewInfo.swapLessonId === lesson.id;
                        const isLessonFlash = flash.lessons.includes(lesson.id);
                        return (
                          <div
                            key={lesson.id}
                            data-lesson-id={lesson.id}
                            className={cn(
                              "flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 transition-all",
                              isLessonSource && "border-brand/50 bg-brand/5",
                              isSwapTarget && "border-brand/60 ring-2 ring-brand/40",
                              isLessonFlash && "curriculum-flash",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-medium text-muted-fg">
                                {mod.sequence_order}.{lesson.sequence_order}
                              </span>
                              <span className="text-sm text-fg">{lesson.description}</span>
                              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                                {lesson.content_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MoveButton
                                direction="up"
                                label={lessonMoveLabel(lesson, upMove)}
                                disabled={!upMove.possible}
                                onPreview={() => setPreview({ type: "lesson", id: lesson.id, direction: "up" })}
                                onPreviewEnd={() => setPreview(null)}
                                onClick={() => handleMoveLesson(lesson, "up")}
                              />
                              <MoveButton
                                direction="down"
                                label={lessonMoveLabel(lesson, downMove)}
                                disabled={!downMove.possible}
                                onPreview={() => setPreview({ type: "lesson", id: lesson.id, direction: "down" })}
                                onPreviewEnd={() => setPreview(null)}
                                onClick={() => handleMoveLesson(lesson, "down")}
                              />
                              {lesson.content_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(lesson.content_url ?? undefined, "_blank")}
                                >
                                  View
                                </Button>
                              )}
                              <button
                                onClick={() => onDeleteLesson(lesson.id, mod.id)}
                                className="rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
                                title="Delete lesson"
                              >
                                <span className="material-symbols-rounded text-[14px]">delete</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => onAddLessonClick(mod.id)}>
                    <span className="material-symbols-rounded text-[14px]">add_circle</span>
                    Add lesson to topic
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <Toast title={toast.title} description={toast.description} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}
