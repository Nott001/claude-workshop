"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/button";
import { Toast } from "@/shared/components/toast";
import type { Lesson } from "@/shared/types";
import { findTimeOverlaps, rowIssueFor, toInputTime, workingRows } from "../lib/scheduling";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import {
  describeLessonMove,
  describeModuleMove,
  moveLesson,
  moveModule,
  type LessonMove,
  type MoveDirection,
} from "../lib/reorder";
import { ModuleCard, type FlashState, type PreviewState } from "./module-card";
import type { TimeField } from "./session-time-picker";

export interface CurriculumBuilderProps {
  modules: ModuleWithLessons[];
  eventSpeakers: CourseSpeaker[];
  eventStartTime?: string | null;
  eventEndTime?: string | null;
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

export function CurriculumBuilder({
  modules,
  eventSpeakers,
  eventStartTime,
  eventEndTime,
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
  const [flash, setFlash] = useState<FlashState>({ lessons: [], modules: [] });
  const flashTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);

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

  const working = workingRows(modules, scheduleDrafts);
  const overlaps = findTimeOverlaps(working);
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

  async function handleTimeChange(mod: ModuleWithLessons, field: TimeField, value: string) {
    const next = { ...draftFor(mod), [field]: value };
    setScheduleDrafts((prev) => ({ ...prev, [mod.id]: next }));

    const start = next.start === "" ? null : next.start;
    const end = next.end === "" ? null : next.end;
    if (start === null && end === null) {
      await commitSchedule(mod, { start_time: null, end_time: null, speaker_profile_id: mod.speaker_profile_id });
      return;
    }
    if (start === null || end === null) return;

    // The picker already greys out anything that would clash; this guard keeps
    // a pre-existing committed overlap (e.g. left behind by a reorder) from
    // being re-committed while the row is still red.
    const proposed = workingRows(modules, { ...scheduleDrafts, [mod.id]: next });
    const blocks = findTimeOverlaps(proposed).some(([a, b]) => a.id === mod.id || b.id === mod.id);
    if (blocks) return;

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
              const scheduleIssue = rowIssueFor(working, overlaps, mod.id);
              return (
                <ModuleCard
                  key={mod.id}
                  mod={mod}
                  modules={modules}
                  isQa={isQa}
                  working={working}
                  eventSpeakers={eventSpeakers}
                  eventStartTime={eventStartTime}
                  eventEndTime={eventEndTime}
                  issue={scheduleIssue}
                  conflicting={conflictingModuleIds.has(mod.id)}
                  preview={preview}
                  flash={flash}
                  renaming={renamingModuleId === mod.id}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  onRenameValueChange={setRenameValue}
                  onCommitRename={() => {
                    if (renameValue.trim()) {
                      onRenameModule(mod.id, renameValue.trim());
                    }
                    setRenamingModuleId(null);
                  }}
                  onCancelRename={() => setRenamingModuleId(null)}
                  onStartRename={() => {
                    setRenamingModuleId(mod.id);
                    setRenameValue(mod.module_name);
                  }}
                  onPreviewModuleMove={(direction) => setPreview({ type: "module", id: mod.id, direction })}
                  onPreviewLessonMove={(lessonId, direction) => setPreview({ type: "lesson", id: lessonId, direction })}
                  onPreviewMoveEnd={() => setPreview(null)}
                  onMoveModule={(direction) => handleMoveModule(mod.id, direction)}
                  onDeleteModule={() => onDeleteModule(mod.id)}
                  startValue={draftFor(mod).start}
                  endValue={draftFor(mod).end}
                  onTimeChange={(field, value) => handleTimeChange(mod, field, value)}
                  onSpeakerChange={(speakerProfileId) => handleSpeakerChange(mod, speakerProfileId)}
                  onAddLessonClick={() => onAddLessonClick(mod.id)}
                  onMoveLesson={(lesson, direction) => handleMoveLesson(lesson, direction)}
                  onDeleteLesson={(lessonId) => onDeleteLesson(lessonId, mod.id)}
                />
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
