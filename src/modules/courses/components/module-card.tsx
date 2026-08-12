"use client";

import type { RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/button";
import type { Lesson } from "@/shared/types";
import { describeLessonMove, describeModuleMove, type MoveDirection } from "../lib/reorder";
import type { RowIssue, ScheduleWindow } from "../lib/scheduling";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import { LessonRow } from "./lesson-row";
import { ModuleHeader } from "./module-header";
import type { TimeField } from "./session-time-picker";

export type PreviewState = { type: "module" | "lesson"; id: number; direction: MoveDirection } | null;

export interface FlashState {
  lessons: number[];
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
  renaming: boolean;
  renameValue: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  startValue: string;
  endValue: string;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onPreviewModuleMove: (direction: MoveDirection) => void;
  onPreviewLessonMove: (lessonId: number, direction: MoveDirection) => void;
  onPreviewMoveEnd: () => void;
  onMoveModule: (direction: MoveDirection) => void;
  onDeleteModule: () => void;
  onTimeChange: (field: TimeField, value: string) => void;
  onSpeakerChange: (speakerProfileId: number | null) => void;
  onAddLessonClick: () => void;
  onMoveLesson: (lesson: Lesson, direction: MoveDirection) => void;
  onDeleteLesson: (lessonId: number) => void;
  onRenameLesson: (lessonId: number, description: string) => Promise<void> | void;
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
  renaming,
  renameValue,
  renameInputRef,
  startValue,
  endValue,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onPreviewModuleMove,
  onPreviewLessonMove,
  onPreviewMoveEnd,
  onMoveModule,
  onDeleteModule,
  onTimeChange,
  onSpeakerChange,
  onAddLessonClick,
  onMoveLesson,
  onDeleteLesson,
  onRenameLesson,
}: ModuleCardProps) {
  const upInfo = describeModuleMove(modules, mod.id, "up");
  const downInfo = describeModuleMove(modules, mod.id, "down");
  const modulePreviewInfo = preview?.type === "module" ? describeModuleMove(modules, preview.id, preview.direction) : null;
  const lessonPreviewInfo = preview?.type === "lesson" ? describeLessonMove(modules, preview.id, preview.direction) : null;
  const isModuleMoveSource = preview?.type === "module" && preview.id === mod.id;
  const isModuleSwapTarget = modulePreviewInfo?.possible === true && modulePreviewInfo.targetModuleId === mod.id;
  const isModuleFlash = flash.modules.includes(mod.id);
  const dropSlot =
    lessonPreviewInfo?.kind === "cross" && lessonPreviewInfo.targetModuleId === mod.id ? lessonPreviewInfo.slot : null;

  const header = (
    <ModuleHeader
      mod={mod}
      isQa={isQa}
      conflicting={conflicting}
      renaming={renaming}
      renameValue={renameValue}
      renameInputRef={renameInputRef}
      onRenameValueChange={onRenameValueChange}
      onCommitRename={onCommitRename}
      onCancelRename={onCancelRename}
      onStartRename={onStartRename}
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
      startValue={startValue}
      endValue={endValue}
      issue={issue}
      onTimeChange={onTimeChange}
      onSpeakerChange={onSpeakerChange}
    />
  );

  if (isQa) {
    return (
      <div
        className={cn(
          "rounded-lg border border-warning/30 bg-warning/5 p-5",
          isModuleSwapTarget && "ring-2 ring-brand/50",
          isModuleFlash && "curriculum-flash",
        )}
      >
        {header}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-muted p-5",
        (isModuleSwapTarget || dropSlot !== null) && "border-brand/60 ring-2 ring-brand/40",
        isModuleMoveSource && "bg-brand/5",
        isModuleFlash && "curriculum-flash",
      )}
    >
      <div className="mb-3">{header}</div>

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
            return (
              <LessonRow
                key={lesson.id}
                mod={mod}
                lesson={lesson}
                upInfo={upMove}
                downInfo={downMove}
                isSource={preview?.type === "lesson" && preview.id === lesson.id}
                isSwapTarget={lessonPreviewInfo?.kind === "within" && lessonPreviewInfo.swapLessonId === lesson.id}
                isFlash={flash.lessons.includes(lesson.id)}
                onPreviewMove={(direction) => onPreviewLessonMove(lesson.id, direction)}
                onPreviewMoveEnd={onPreviewMoveEnd}
                onMove={(direction) => onMoveLesson(lesson, direction)}
                onDelete={() => onDeleteLesson(lesson.id)}
                onRenameLesson={onRenameLesson}
              />
            );
          })}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onAddLessonClick}>
        <span className="material-symbols-rounded text-[14px]">add_circle</span>
        Add lesson to topic
      </Button>
    </div>
  );
}
