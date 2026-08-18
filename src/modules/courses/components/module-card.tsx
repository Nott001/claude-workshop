"use client";

import type { RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/button";
import { describeModuleMove, type MoveDirection } from "../lib/reorder";
import type { RowIssue, ScheduleWindow } from "../lib/scheduling";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import type { ModuleDraft } from "../lib/module-draft";
import { LessonRow } from "./lesson-row";
import { ModuleHeader } from "./module-header";
import type { ViewerTarget } from "./material-viewer";
import type { TimeField } from "./session-time-picker";

export type PreviewState = { type: "module"; id: number; direction: MoveDirection } | null;

export interface FlashState {
  modules: number[];
}

interface ModuleCardProps {
  mod: ModuleWithLessons;
  modules: ModuleWithLessons[];
  isQa: boolean;
  working: ScheduleWindow[];
  eventSpeakers: CourseSpeaker[];
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  issue: RowIssue | null;
  conflicting: boolean;
  preview: PreviewState;
  flash: FlashState;
  /** Non-null exactly when this module is the one being edited. */
  draft: ModuleDraft | null;
  saving: boolean;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (next: ModuleDraft) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onPreviewModuleMove: (direction: MoveDirection) => void;
  onPreviewMoveEnd: () => void;
  onMoveModule: (direction: MoveDirection) => void;
  onDeleteModule: () => void;
  onAddLesson: () => void;
  onMoveLesson: (key: string, direction: MoveDirection) => void;
  onDeleteLesson: (key: string) => void;
  onMoveLessonToModule: (lessonId: number, targetModuleId: number) => void;
  onView: (target: ViewerTarget) => void;
}

export function ModuleCard({
  mod,
  modules,
  isQa,
  working,
  eventSpeakers,
  eventStartTime,
  eventEndTime,
  issue,
  conflicting,
  preview,
  flash,
  draft,
  saving,
  nameInputRef,
  onDraftChange,
  onEdit,
  onSave,
  onCancel,
  onPreviewModuleMove,
  onPreviewMoveEnd,
  onMoveModule,
  onDeleteModule,
  onAddLesson,
  onMoveLesson,
  onDeleteLesson,
  onMoveLessonToModule,
  onView,
}: ModuleCardProps) {
  const editing = draft !== null;
  const upInfo = describeModuleMove(modules, mod.id, "up");
  const downInfo = describeModuleMove(modules, mod.id, "down");
  const previewInfo = preview ? describeModuleMove(modules, preview.id, preview.direction) : null;
  const isSwapTarget = previewInfo?.possible === true && previewInfo.targetModuleId === mod.id;
  const isSource = preview?.id === mod.id;

  const header = (
    <ModuleHeader
      mod={mod}
      isQa={isQa}
      conflicting={conflicting}
      editing={editing}
      saving={saving}
      name={draft ? draft.module_name : mod.module_name}
      nameInputRef={nameInputRef}
      onNameChange={(module_name) => draft && onDraftChange({ ...draft, module_name })}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
      upInfo={upInfo}
      downInfo={downInfo}
      onPreviewMove={onPreviewModuleMove}
      onPreviewMoveEnd={onPreviewMoveEnd}
      onMove={onMoveModule}
      onDelete={onDeleteModule}
      working={working}
      eventSpeakers={eventSpeakers}
      eventStartTime={eventStartTime}
      eventEndTime={eventEndTime}
      startValue={draft ? (draft.start_time ?? "") : (mod.start_time?.slice(0, 5) ?? "")}
      endValue={draft ? (draft.end_time ?? "") : (mod.end_time?.slice(0, 5) ?? "")}
      speakerValue={draft ? draft.speaker_profile_id : mod.speaker_profile_id}
      issue={issue}
      onTimeChange={(field: TimeField, value: string) => {
        if (!draft) return;
        const key = field === "start" ? "start_time" : "end_time";
        onDraftChange({ ...draft, [key]: value === "" ? null : value });
      }}
      onSpeakerChange={(speaker_profile_id) => draft && onDraftChange({ ...draft, speaker_profile_id })}
    />
  );

  if (isQa) {
    return (
      <div
        className={cn(
          "rounded-lg border border-warning/30 bg-warning/5 p-5",
          isSwapTarget && "ring-2 ring-brand/50",
          flash.modules.includes(mod.id) && "curriculum-flash",
        )}
      >
        {header}
      </div>
    );
  }

  const rows = draft
    ? draft.lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        key: lesson.key,
        ordinal: `${mod.sequence_order}.${index + 1}`,
        name: lesson.name,
        description: lesson.description,
        contentType: lesson.content_type,
        contentUrl: lesson.content_url,
        pendingFileName: lesson.pendingFile?.name ?? null,
        canMoveUp: index > 0,
        canMoveDown: index < draft.lessons.length - 1,
      }))
    : mod.LESSONS.map((lesson) => ({
        lessonId: lesson.id,
        key: `lesson-${lesson.id}`,
        ordinal: `${mod.sequence_order}.${lesson.sequence_order}`,
        name: lesson.name,
        description: lesson.description,
        contentType: lesson.content_type,
        contentUrl: lesson.content_url,
        pendingFileName: null,
        canMoveUp: false,
        canMoveDown: false,
      }));

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-muted p-5 transition-all",
        isSwapTarget && "border-brand/60 ring-2 ring-brand/40",
        isSource && "bg-brand/5",
        editing && "border-brand/50 ring-2 ring-brand/25",
        flash.modules.includes(mod.id) && "curriculum-flash",
      )}
    >
      <div className="mb-3">{header}</div>

      {rows.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {rows.map((row) => (
            <LessonRow
              key={row.key}
              ordinal={row.ordinal}
              name={row.name}
              description={row.description}
              contentType={row.contentType}
              contentUrl={row.contentUrl}
              pendingFileName={row.pendingFileName}
              editing={editing}
              canMoveUp={row.canMoveUp}
              canMoveDown={row.canMoveDown}
              linkUrl={row.contentType === "link" ? (row.contentUrl ?? "") : ""}
              onView={() => row.contentUrl && onView({ name: row.name, contentType: row.contentType, url: row.contentUrl })}
              onNameChange={(name) => draft && onDraftChange(patchLesson(draft, row.key, { name }))}
              onDescriptionChange={(description) => draft && onDraftChange(patchLesson(draft, row.key, { description }))}
              onLinkChange={(value) =>
                draft &&
                onDraftChange(
                  patchLesson(draft, row.key, {
                    content_type: "link",
                    content_url: value === "" ? null : value,
                    pendingFile: null,
                  }),
                )
              }
              onPickFile={(file) =>
                draft && onDraftChange(patchLesson(draft, row.key, { pendingFile: file, content_type: fileType(file) }))
              }
              onRemoveMaterial={() =>
                draft &&
                onDraftChange(patchLesson(draft, row.key, { dropMaterial: true, content_url: null, pendingFile: null }))
              }
              onMove={(direction) => onMoveLesson(row.key, direction)}
              onDelete={() => onDeleteLesson(row.key)}
              moveTargets={
                editing || row.lessonId === null
                  ? []
                  : modules
                      .filter((m) => m.id !== mod.id && m.module_type !== "qa")
                      .map((m) => ({ id: m.id, name: m.module_name }))
              }
              onMoveToModule={(targetModuleId) => row.lessonId !== null && onMoveLessonToModule(row.lessonId, targetModuleId)}
            />
          ))}
        </div>
      )}

      {editing ? (
        <Button variant="secondary" size="sm" onClick={onAddLesson}>
          <span aria-hidden className="material-symbols-rounded text-[14px]">
            add_circle
          </span>
          Add lesson
        </Button>
      ) : (
        rows.length === 0 && <p className="text-xs text-muted-fg">No lessons yet — use Edit to add one.</p>
      )}
    </div>
  );
}

function patchLesson(draft: ModuleDraft, key: string, changes: Record<string, unknown>): ModuleDraft {
  return {
    ...draft,
    lessons: draft.lessons.map((lesson) => (lesson.key === key ? { ...lesson, ...changes } : lesson)),
  };
}

/** Mirrors the upload policy: anything that is not a video or a PDF is an image. */
function fileType(file: File): "video" | "pdf" | "image" {
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  return "image";
}
