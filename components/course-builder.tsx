"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  DragOverlay,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Lesson {
  lesson_id: number;
  module_id: number;
  description: string;
  content_type: string;
  content_url: string | null;
  sequence_order: number;
}

interface Module {
  module_id: number;
  course_id: number;
  module_name: string;
  sequence_order: number;
  LESSONS: Lesson[];
}

interface CourseBuilderProps {
  modules: Module[];
  onModulesChange: (modules: Module[]) => void;
  onAddLesson: (moduleId: number) => void;
  onDeleteLesson: (lessonId: number, moduleId: number) => void;
  renamingModuleId: number | null;
  setRenamingModuleId: (id: number | null) => void;
  renameValue: string;
  setRenameValue: (value: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameModule: (moduleId: number) => void;
  onDeleteModule: (moduleId: number) => void;
  emptyState?: ReactNode;
}

const courseCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableRects, ...rest } = args;
  const activeId = String(active.id);

  const filteredRects = new Map(
    Array.from(droppableRects.entries()).filter(([id]) => {
      const idStr = String(id);
      if (activeId.startsWith("module-")) {
        return idStr.startsWith("module-") && !idStr.includes("-start-") && !idStr.includes("-end-");
      }
      return idStr.startsWith("lesson-") || idStr.startsWith("module-start-") || idStr.startsWith("module-end-");
    }),
  );

  return closestCenter({ ...rest, active, droppableRects: filteredRects });
};

function SortableModuleCard({
  moduleId,
  children,
}: {
  moduleId: number;
  children: (props: { dragHandleProps: Record<string, unknown>; isDragging: boolean; isModuleDragOver: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting, overIndex, index } = useSortable({
    id: `module-${moduleId}`,
  });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
        isModuleDragOver: isSorting && overIndex === index && !isDragging,
      })}
    </div>
  );
}

function SortableLessonRow({
  lesson,
  onDeleteLesson,
  lessonNumber,
}: {
  lesson: Lesson;
  onDeleteLesson: (id: number, moduleId: number) => void;
  lessonNumber: string;
}) {
  const dndContext = useDndContext();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, rect } = useSortable({
    id: `lesson-${lesson.lesson_id}`,
  });

  const activeTranslated = dndContext.active?.rect?.current?.translated;
  const thisCenterY = rect.current ? rect.current.top + rect.current.height / 2 : 0;
  const draggedCenterY = activeTranslated ? activeTranslated.top + activeTranslated.height / 2 : 0;
  const isAbove = activeTranslated && rect.current ? draggedCenterY < thisCenterY : true;
  const showLine = isOver && !isDragging;
  const showLineAbove = showLine && isAbove;
  const showLineBelow = showLine && !isAbove;

  return (
    <div className="relative">
      {showLineAbove && (
        <div className="absolute -top-[3px] left-4 right-4 z-10 flex items-center gap-1.5 pointer-events-none">
          <div className="h-[2px] flex-1 rounded-full bg-[#29B6F6]" />
          <div className="size-2 shrink-0 rounded-full bg-[#29B6F6]" />
          <div className="h-[2px] flex-1 rounded-full bg-[#29B6F6]" />
        </div>
      )}
      {showLineBelow && (
        <div className="absolute -bottom-[3px] left-4 right-4 z-10 flex items-center gap-1.5 pointer-events-none">
          <div className="h-[2px] flex-1 rounded-full bg-[#29B6F6]" />
          <div className="size-2 shrink-0 rounded-full bg-[#29B6F6]" />
          <div className="h-[2px] flex-1 rounded-full bg-[#29B6F6]" />
        </div>
      )}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
        className={`flex items-center justify-between rounded-lg border px-4 py-2.5 transition-all ${
          isDragging ? "border-[#29B6F6] bg-white opacity-40" : "border-[#F3F4F6] bg-white"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-rounded text-[14px] text-[#9CA3AF] cursor-grab">drag_indicator</span>
          <span className="text-xs font-medium text-[#9CA3AF]">{lessonNumber}</span>
          <span className="text-sm text-[#374151]">{lesson.description}</span>
          <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
            {lesson.content_type}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {lesson.content_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(lesson.content_url, "_blank");
              }}
            >
              View
            </Button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteLesson(lesson.lesson_id, lesson.module_id);
            }}
            className="rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-red-50 hover:text-[#DC2626]"
            title="Delete lesson"
          >
            <span className="material-symbols-rounded text-[14px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonListDropZone({ moduleId, position }: { moduleId: number; position: "start" | "end" }) {
  const id = `module-${position}-${moduleId}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const label = position === "start" ? "top" : "bottom";
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-all ${
        isOver ? "mb-1.5 flex h-12 items-center justify-center border-2 border-dashed border-[#29B6F6] bg-blue-50" : "h-4"
      }`}
    >
      {isOver && <span className="text-xs font-medium text-[#2563EB]">Drop lesson at {label}</span>}
    </div>
  );
}

function DragPreview({ id, modules }: { id: string; modules: Module[] }) {
  if (id.startsWith("module-")) {
    const moduleId = Number(id.replace("module-", ""));
    const mod = modules.find((m) => m.module_id === moduleId);
    if (!mod) return null;
    return (
      <div className="rounded-lg border border-[#29B6F6] bg-white p-5 shadow-lg">
        <span className="text-sm font-semibold text-[#334155]">{mod.module_name}</span>
        <span className="ml-2 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">
          {mod.LESSONS.length} {mod.LESSONS.length === 1 ? "lesson" : "lessons"}
        </span>
      </div>
    );
  }
  if (id.startsWith("lesson-")) {
    const lessonId = Number(id.replace("lesson-", ""));
    for (const mod of modules) {
      const lesson = mod.LESSONS.find((l) => l.lesson_id === lessonId);
      if (lesson) {
        return (
          <div className="rounded-lg border border-[#29B6F6] bg-white px-4 py-2.5 shadow-lg">
            <span className="text-sm text-[#374151]">{lesson.description}</span>
            <span className="ml-2 rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
              {lesson.content_type}
            </span>
          </div>
        );
      }
    }
  }
  return null;
}

export default function CourseBuilder({
  modules,
  onModulesChange,
  onAddLesson,
  onDeleteLesson,
  renamingModuleId,
  setRenamingModuleId,
  renameValue,
  setRenameValue,
  renameInputRef,
  onRenameModule,
  onDeleteModule,
  emptyState,
}: CourseBuilderProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  async function persistLessons(lessons: Lesson[], includeModuleId = false) {
    await Promise.all(
      lessons.map((l) => {
        const patchBody: Record<string, unknown> = {
          description: l.description,
          content_type: l.content_type,
          sequence_order: l.sequence_order,
        };
        if (includeModuleId) {
          patchBody.module_id = l.module_id;
        }
        if (l.content_url) {
          patchBody.content_url = l.content_url;
        }
        return fetch(`/api/lessons/${l.lesson_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      }),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    if (activeId.startsWith("module-")) {
      const activeModuleId = Number(activeId.replace("module-", ""));
      if (!overId.startsWith("module-")) return;
      const overModuleId = Number(overId.replace("module-", ""));
      if (activeModuleId === overModuleId) return;

      const m = [...modules];
      const oldIdx = m.findIndex((x) => x.module_id === activeModuleId);
      const newIdx = m.findIndex((x) => x.module_id === overModuleId);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(m, oldIdx, newIdx).map((x, i) => ({
        ...x,
        sequence_order: i + 1,
      }));
      onModulesChange(reordered);

      await Promise.all(
        reordered.map((x) =>
          fetch(`/api/modules/${x.module_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ module_name: x.module_name, sequence_order: x.sequence_order }),
          }),
        ),
      );
    } else if (activeId.startsWith("lesson-")) {
      const draggedLessonId = Number(activeId.replace("lesson-", ""));
      const fromModule = modules.find((m) => m.LESSONS.some((l) => l.lesson_id === draggedLessonId));
      if (!fromModule) return;

      let targetModuleId: number;
      let insertIndex: number;

      if (overId.startsWith("lesson-")) {
        const overLessonId = Number(overId.replace("lesson-", ""));
        const overModule = modules.find((m) => m.LESSONS.some((l) => l.lesson_id === overLessonId));
        if (!overModule) return;
        targetModuleId = overModule.module_id;
        insertIndex = overModule.LESSONS.findIndex((l) => l.lesson_id === overLessonId);
        if (insertIndex === -1) return;

        const draggedRect = active.rect?.current?.translated;
        const overRect = over.rect;
        if (draggedRect && overRect) {
          const draggedCenterY = draggedRect.top + draggedRect.height / 2;
          const overCenterY = overRect.top + overRect.height / 2;
          if (draggedCenterY > overCenterY) {
            insertIndex++;
          }
        }
      } else if (overId.startsWith("module-start-")) {
        targetModuleId = Number(overId.replace("module-start-", ""));
        insertIndex = 0;
      } else if (overId.startsWith("module-end-")) {
        targetModuleId = Number(overId.replace("module-end-", ""));
        const targetMod = modules.find((m) => m.module_id === targetModuleId);
        if (!targetMod) return;
        insertIndex = targetMod.LESSONS.length;
      } else {
        return;
      }

      const sourceCopy = [...fromModule.LESSONS];
      const draggedIdx = sourceCopy.findIndex((l) => l.lesson_id === draggedLessonId);
      if (draggedIdx === -1) return;
      const [moved] = sourceCopy.splice(draggedIdx, 1);

      if (fromModule.module_id === targetModuleId) {
        const targetIdx = insertIndex > draggedIdx ? insertIndex - 1 : insertIndex;
        sourceCopy.splice(targetIdx, 0, moved);
        const reordered = sourceCopy.map((l, i) => ({ ...l, sequence_order: i + 1 }));
        onModulesChange(modules.map((m) => (m.module_id === targetModuleId ? { ...m, LESSONS: reordered } : m)));
        await persistLessons(reordered);
      } else {
        const targetMod = modules.find((m) => m.module_id === targetModuleId);
        if (!targetMod) return;
        const targetCopy = [...targetMod.LESSONS];
        targetCopy.splice(insertIndex, 0, { ...moved, module_id: targetModuleId });

        const reorderedSource = sourceCopy.map((l, i) => ({ ...l, sequence_order: i + 1 }));
        const reorderedTarget = targetCopy.map((l, i) => ({ ...l, sequence_order: i + 1 }));

        onModulesChange(
          modules.map((m) => {
            if (m.module_id === fromModule.module_id) return { ...m, LESSONS: reorderedSource };
            if (m.module_id === targetModuleId) return { ...m, LESSONS: reorderedTarget };
            return m;
          }),
        );

        const patched = [
          ...reorderedSource.map((l) => ({ ...l, module_id: fromModule.module_id })),
          ...reorderedTarget.map((l) => ({
            ...l,
            module_id: l.lesson_id === draggedLessonId ? targetModuleId : l.module_id,
          })),
        ];
        await persistLessons(patched, true);
      }
    }
  }

  if (modules.length === 0) {
    return (
      <>
        {emptyState ?? (
          <div className="rounded-lg border-2 border-dashed border-[#D1D5DB] py-12 text-center">
            <span className="material-symbols-rounded mb-2 block text-[32px] text-[#D1D5DB]">post_add</span>
            <p className="text-sm text-[#6B7280]">No modules yet. Add your first module to start building the curriculum.</p>
          </div>
        )}
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={courseCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={modules.map((m) => `module-${m.module_id}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {modules.map((mod) => {
            return (
              <SortableModuleCard key={mod.module_id} moduleId={mod.module_id}>
                {({ dragHandleProps, isDragging, isModuleDragOver }) => (
                  <div
                    className={`rounded-lg border bg-[#FAFBFC] p-5 transition-shadow ${
                      isDragging
                        ? "opacity-40"
                        : isModuleDragOver
                          ? "border-[#29B6F6] shadow-[0_0_0_2px_rgba(41,182,246,0.2)]"
                          : "border-[#F3F4F6]"
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span {...dragHandleProps} className="cursor-grab rounded-md p-1 text-[#9CA3AF] hover:bg-[#F3F4F6]">
                        <span className="material-symbols-rounded text-[14px]">drag_indicator</span>
                      </span>

                      {renamingModuleId === mod.module_id ? (
                        <input
                          ref={renameInputRef as React.RefObject<HTMLInputElement>}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onRenameModule(mod.module_id);
                            if (e.key === "Escape") setRenamingModuleId(null);
                          }}
                          onBlur={() => onRenameModule(mod.module_id)}
                          className="rounded-lg border border-[#29B6F6] bg-white px-3 py-1.5 text-sm font-semibold text-[#374151] outline-none ring-2 ring-[#29B6F6]/20"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-[#334155]">{mod.module_name}</span>
                      )}

                      <button
                        onClick={() => {
                          setRenamingModuleId(mod.module_id);
                          setRenameValue(mod.module_name);
                        }}
                        className="rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#334155]"
                        title="Rename module"
                      >
                        <span className="material-symbols-rounded text-[14px]">edit</span>
                      </button>

                      <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-medium text-[#2563EB]">
                        {mod.LESSONS.length} {mod.LESSONS.length === 1 ? "lesson" : "lessons"}
                      </span>

                      <button
                        onClick={() => onDeleteModule(mod.module_id)}
                        className="ml-auto rounded-md p-1 text-[#9CA3AF] transition-colors hover:bg-red-50 hover:text-[#DC2626]"
                        title="Delete module"
                      >
                        <span className="material-symbols-rounded text-[14px]">delete</span>
                      </button>
                    </div>

                    <SortableContext
                      items={mod.LESSONS.map((l) => `lesson-${l.lesson_id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <LessonListDropZone moduleId={mod.module_id} position="start" />
                      {mod.LESSONS.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {mod.LESSONS.map((lesson) => (
                            <SortableLessonRow
                              key={lesson.lesson_id}
                              lesson={lesson}
                              onDeleteLesson={onDeleteLesson}
                              lessonNumber={`${mod.sequence_order}.${lesson.sequence_order}`}
                            />
                          ))}
                        </div>
                      )}
                      <LessonListDropZone moduleId={mod.module_id} position="end" />
                    </SortableContext>

                    <Button variant="ghost" size="sm" onClick={() => onAddLesson(mod.module_id)}>
                      <span className="material-symbols-rounded text-[14px]">add_circle</span>
                      Add lesson to topic
                    </Button>
                  </div>
                )}
              </SortableModuleCard>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>{activeDragId ? <DragPreview id={activeDragId} modules={modules} /> : null}</DragOverlay>
    </DndContext>
  );
}
