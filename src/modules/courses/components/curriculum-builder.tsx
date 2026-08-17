"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/button";
import { Toast } from "@/shared/components/toast";
import { findTimeOverlaps, rowIssueFor, workingRows } from "../lib/scheduling";
import { BUILDER_SURFACE } from "../lib/surface";
import { createDraft, draftLesson, moveDraftLesson, removeDraftLesson, type ModuleDraft } from "../lib/module-draft";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import { describeModuleMove, moveLessonToModule, moveModule, type LessonMove, type MoveDirection } from "../lib/reorder";
import { ModuleCard, type FlashState, type PreviewState } from "./module-card";
import { MaterialViewer, type ViewerTarget } from "./material-viewer";

export interface CurriculumBuilderProps {
  modules: ModuleWithLessons[];
  eventSpeakers: CourseSpeaker[];
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  onAddModule: () => Promise<number | undefined> | number | undefined;
  onAddQaModule: () => Promise<number | undefined> | number | undefined;
  onDeleteModule: (moduleId: number) => void;
  onReorderModules: (modules: ModuleWithLessons[]) => Promise<void>;
  /** Cross-module lesson moves write straight through; see moveLessonToModule. */
  onMoveLesson: (modules: ModuleWithLessons[], updates: LessonMove[]) => Promise<void>;
  /** One batched write for everything a module's editor changed. */
  onSaveModule: (draft: ModuleDraft) => Promise<string | null>;
}

export function CurriculumBuilder({
  modules,
  eventSpeakers,
  eventStartTime,
  eventEndTime,
  onAddModule,
  onAddQaModule,
  onDeleteModule,
  onReorderModules,
  onMoveLesson,
  onSaveModule,
}: CurriculumBuilderProps) {
  // One module is editable at a time: a draft spans a module, and two open at
  // once would let a reader believe a Save had covered both.
  const [draft, setDraft] = useState<ModuleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ViewerTarget | null>(null);

  const [preview, setPreview] = useState<PreviewState>(null);
  const [flash, setFlash] = useState<FlashState>({ modules: [] });
  const flashTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
    // Only when the edited module changes — not on every keystroke in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.moduleId]);

  function flashModule(moduleId: number) {
    setFlash({ modules: [moduleId] });
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash({ modules: [] }), 1000);
  }

  async function handleAddModuleClick() {
    const newModuleId = await onAddModule();
    if (newModuleId != null) setToast({ title: "Module added", description: "Use Edit to name it and add lessons." });
  }

  async function handleAddQaModuleClick() {
    await onAddQaModule();
  }

  function handleMoveModule(moduleId: number, direction: MoveDirection) {
    if (!describeModuleMove(modules, moduleId, direction).possible) return;
    const next = moveModule(modules, moduleId, direction);
    if (!next) return;
    void onReorderModules(next);
    setPreview(null);
    flashModule(moduleId);
  }

  function handleMoveLessonToModule(lessonId: number, targetModuleId: number) {
    const next = moveLessonToModule(modules, lessonId, targetModuleId);
    if (!next) return;
    void onMoveLesson(next.modules, next.updates);
    setToast({
      title: `Lesson moved to ${modules.find((m) => m.id === targetModuleId)?.module_name ?? "another module"}`,
      description: "It is now the last lesson there.",
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    const failure = await onSaveModule(draft);
    setSaving(false);

    if (failure) {
      setToast({ title: "Could not save the module", description: failure });
      return;
    }
    setDraft(null);
  }

  const working = workingRows(modules, {});
  const overlaps = findTimeOverlaps(working);
  const conflictingModuleIds = new Set(overlaps.flatMap(([a, b]) => [a.id, b.id]));

  return (
    <div className={BUILDER_SURFACE}>
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="rounded-lg bg-info/10 p-2">
          <span aria-hidden className="material-symbols-rounded text-[20px] text-brand">
            school
          </span>
        </div>
        <span className="text-xs font-bold tracking-[0.1em] text-fg">CURRICULUM</span>
      </div>

      <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-fg">
          {draft
            ? "Editing a module — changes are held until you press Save."
            : "Organize your course into modules and lessons."}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleAddQaModuleClick} disabled={draft !== null}>
            <span aria-hidden className="material-symbols-rounded text-[14px]">
              forum
            </span>
            Add Q&A
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAddModuleClick} disabled={draft !== null}>
            <span aria-hidden className="material-symbols-rounded text-[14px]">
              add_circle
            </span>
            Add module
          </Button>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
          <span aria-hidden className="material-symbols-rounded mb-2 block text-[32px] text-muted-fg">
            post_add
          </span>
          <p className="text-sm text-muted-fg">No modules yet. Add your first module to start building the curriculum.</p>
        </div>
      ) : (
        <>
          {overlaps.length > 0 && (
            <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              <span aria-hidden className="material-symbols-rounded text-[18px]">
                warning
              </span>
              <span>
                Fix required — overlapping sessions:{" "}
                {overlaps.map(([a, b]) => `"${a.module_name}" and "${b.module_name}"`).join(", ")}.
              </span>
            </div>
          )}
          <div className="space-y-3">
            {modules.map((mod) => (
              <ModuleCard
                key={mod.id}
                mod={mod}
                modules={modules}
                isQa={mod.module_type === "qa"}
                working={working}
                eventSpeakers={eventSpeakers}
                eventStartTime={eventStartTime}
                eventEndTime={eventEndTime}
                issue={rowIssueFor(working, overlaps, mod.id)}
                conflicting={conflictingModuleIds.has(mod.id)}
                preview={preview}
                flash={flash}
                draft={draft?.moduleId === mod.id ? draft : null}
                saving={saving}
                nameInputRef={nameInputRef}
                onDraftChange={setDraft}
                onEdit={() => setDraft(createDraft(mod))}
                onSave={handleSave}
                onCancel={() => setDraft(null)}
                onPreviewModuleMove={(direction) => setPreview({ type: "module", id: mod.id, direction })}
                onPreviewMoveEnd={() => setPreview(null)}
                onMoveModule={(direction) => handleMoveModule(mod.id, direction)}
                onDeleteModule={() => onDeleteModule(mod.id)}
                onAddLesson={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          lessons: [
                            ...current.lessons,
                            draftLesson({ name: `Lesson ${current.lessons.length + 1}`, content_type: "link" }),
                          ],
                        }
                      : current,
                  )
                }
                onMoveLesson={(key, direction) =>
                  setDraft((current) => (current ? moveDraftLesson(current, key, direction) : current))
                }
                onDeleteLesson={(key) => setDraft((current) => (current ? removeDraftLesson(current, key) : current))}
                onMoveLessonToModule={handleMoveLessonToModule}
                onView={setViewing}
              />
            ))}
          </div>
        </>
      )}

      <MaterialViewer target={viewing} onClose={() => setViewing(null)} />

      {toast && (
        <div className="fixed right-6 bottom-6 z-50">
          <Toast title={toast.title} description={toast.description} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}
