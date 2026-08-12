"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/button";
import type { Lesson } from "@/shared/types";
import type { LessonMoveInfo, MoveDirection } from "../lib/reorder";
import type { ModuleWithLessons } from "../lib/types";
import { lessonMoveLabel, MoveButton } from "./move-button";

interface LessonRowProps {
  mod: ModuleWithLessons;
  lesson: Lesson;
  upInfo: LessonMoveInfo;
  downInfo: LessonMoveInfo;
  isSource: boolean;
  isSwapTarget: boolean;
  isFlash: boolean;
  onPreviewMove: (direction: MoveDirection) => void;
  onPreviewMoveEnd: () => void;
  onMove: (direction: MoveDirection) => void;
  onDelete: () => void;
  onRenameLesson: (lessonId: number, description: string) => Promise<void> | void;
}

export function LessonRow({
  mod,
  lesson,
  upInfo,
  downInfo,
  isSource,
  isSwapTarget,
  isFlash,
  onPreviewMove,
  onPreviewMoveEnd,
  onMove,
  onDelete,
  onRenameLesson,
}: LessonRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(lesson.description);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setEditValue(lesson.description);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== lesson.description) {
      onRenameLesson(lesson.id, trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setEditing(false);
    }
  }

  return (
    <div
      data-lesson-id={lesson.id}
      className={cn(
        "flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 transition-all",
        isSource && "border-brand/50 bg-brand/5",
        isSwapTarget && "border-brand/60 ring-2 ring-brand/40",
        isFlash && "curriculum-flash",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs font-medium text-muted-fg shrink-0">
          {mod.sequence_order}.{lesson.sequence_order}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-brand bg-surface px-2 py-0.5 text-sm text-fg outline-none"
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            title="Rename lesson"
            className="cursor-pointer rounded px-1 py-0.5 text-sm text-fg transition-colors hover:bg-muted"
            onClick={startEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") startEdit();
            }}
          >
            {lesson.description}
          </span>
        )}
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
          {lesson.content_type}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <MoveButton
          direction="up"
          label={lessonMoveLabel(lesson, upInfo)}
          disabled={!upInfo.possible}
          onPreview={() => onPreviewMove("up")}
          onPreviewEnd={onPreviewMoveEnd}
          onClick={() => onMove("up")}
        />
        <MoveButton
          direction="down"
          label={lessonMoveLabel(lesson, downInfo)}
          disabled={!downInfo.possible}
          onPreview={() => onPreviewMove("down")}
          onPreviewEnd={onPreviewMoveEnd}
          onClick={() => onMove("down")}
        />
        {lesson.content_url && (
          <Button variant="ghost" size="sm" onClick={() => window.open(lesson.content_url ?? undefined, "_blank")}>
            View
          </Button>
        )}
        <button
          onClick={onDelete}
          className="rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
          title="Delete lesson"
        >
          <span className="material-symbols-rounded text-[14px]">delete</span>
        </button>
      </div>
    </div>
  );
}
