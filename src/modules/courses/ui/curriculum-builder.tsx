"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import type { Lesson } from "@/shared/types";
import type { ModuleWithLessons } from "../lib/types";

interface CurriculumBuilderProps {
  modules: ModuleWithLessons[];
  onAddModule: () => Promise<number | undefined> | number | undefined;
  onRenameModule: (moduleId: number, newName: string) => Promise<void> | void;
  onDeleteModule: (moduleId: number) => Promise<void> | void;
  onDeleteLesson: (lessonId: number, moduleId: number) => Promise<void> | void;
  onAddLessonClick: (moduleId: number) => void;
  onReorderModules: (modules: ModuleWithLessons[]) => Promise<void>;
  onReorderLessons: (moduleId: number, lessons: Lesson[]) => Promise<void>;
}

export function CurriculumBuilder({
  modules,
  onAddModule,
  onRenameModule,
  onDeleteModule,
  onDeleteLesson,
  onAddLessonClick,
  onReorderModules,
  onReorderLessons,
}: CurriculumBuilderProps) {
  const [renamingModuleId, setRenamingModuleId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<number | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<number | null>(null);

  useEffect(() => {
    if (renamingModuleId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingModuleId]);

  async function handleAddModuleClick() {
    const newModuleId = await onAddModule();
    if (newModuleId != null) {
      setRenamingModuleId(newModuleId);
      setRenameValue("New Module");
    }
  }

  function handleModuleDragStart(e: React.DragEvent, moduleId: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(moduleId));
  }

  async function handleModuleDragOver(e: React.DragEvent, moduleId: number) {
    e.preventDefault();
    setDragOverModuleId(moduleId);
  }

  async function handleModuleDrop(e: React.DragEvent, targetModuleId: number) {
    e.preventDefault();
    setDragOverModuleId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetModuleId) return;

    const draggedIdx = modules.findIndex((m) => m.id === draggedId);
    const targetIdx = modules.findIndex((m) => m.id === targetModuleId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const next = [...modules];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(targetIdx, 0, moved);
    const reordered = next.map((m, i) => ({ ...m, sequence_order: i + 1 }));

    await onReorderModules(reordered);
  }

  function handleLessonDragStart(e: React.DragEvent, lessonId: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(lessonId));
  }

  async function handleLessonDrop(e: React.DragEvent, targetLessonId: number, moduleId: number) {
    e.preventDefault();
    setDragOverLessonId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetLessonId) return;

    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const lessons = [...mod.LESSONS];
    const draggedIdx = lessons.findIndex((l) => l.id === draggedId);
    const targetIdx = lessons.findIndex((l) => l.id === targetLessonId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [moved] = lessons.splice(draggedIdx, 1);
    lessons.splice(targetIdx, 0, moved);
    const reordered = lessons.map((l, i) => ({ ...l, sequence_order: i + 1 }));

    await onReorderLessons(moduleId, reordered);
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
        <Button variant="secondary" size="sm" onClick={handleAddModuleClick}>
          <span className="material-symbols-rounded text-[14px]">add_circle</span>
          Add module
        </Button>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
          <span className="material-symbols-rounded mb-2 block text-[32px] text-muted-fg">post_add</span>
          <p className="text-sm text-muted-fg">No modules yet. Add your first module to start building the curriculum.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod) => (
            <div
              key={mod.id}
              draggable
              onDragStart={(e) => handleModuleDragStart(e, mod.id)}
              onDragOver={(e) => handleModuleDragOver(e, mod.id)}
              onDragLeave={() => setDragOverModuleId(null)}
              onDrop={(e) => handleModuleDrop(e, mod.id)}
              onDragEnd={() => setDragOverModuleId(null)}
              className={`rounded-lg border bg-muted p-5 transition-shadow ${
                dragOverModuleId === mod.id ? "border-brand shadow-[0_0_0_2px_rgba(41,182,246,0.2)]" : "border-border"
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
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

                <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
                  {mod.LESSONS.length} {mod.LESSONS.length === 1 ? "lesson" : "lessons"}
                </span>

                <button
                  onClick={() => onDeleteModule(mod.id)}
                  className="ml-auto rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
                  title="Delete module"
                >
                  <span className="material-symbols-rounded text-[14px]">delete</span>
                </button>
              </div>

              {mod.LESSONS.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {mod.LESSONS.map((lesson) => (
                    <div
                      key={lesson.id}
                      draggable
                      onDragStart={(e) => handleLessonDragStart(e, lesson.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverLessonId(lesson.id);
                      }}
                      onDragLeave={() => setDragOverLessonId(null)}
                      onDrop={(e) => handleLessonDrop(e, lesson.id, mod.id)}
                      onDragEnd={() => setDragOverLessonId(null)}
                      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 transition-shadow ${
                        dragOverLessonId === lesson.id
                          ? "border-brand bg-surface shadow-[0_0_0_2px_rgba(41,182,246,0.2)]"
                          : "border-border bg-surface"
                      }`}
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
                  ))}
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={() => onAddLessonClick(mod.id)}>
                <span className="material-symbols-rounded text-[14px]">add_circle</span>
                Add lesson to topic
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
