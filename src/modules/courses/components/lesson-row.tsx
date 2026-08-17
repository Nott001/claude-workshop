"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/button";
import type { Lesson } from "@/shared/types";
import type { LessonMoveInfo, MoveDirection } from "../lib/reorder";
import type { ModuleWithLessons } from "../lib/types";
import { lessonMoveLabel, MoveButton } from "./move-button";

type EditTarget = "name" | "description";

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
  onRenameLesson: (lessonId: number, name: string) => Promise<void> | void;
  onUpdateLessonDescription: (lessonId: number, description: string | null) => Promise<void> | void;
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
  onUpdateLessonDescription,
}: LessonRowProps) {
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editTarget && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editTarget]);

  // `Lesson` types every field as present, but the row renders whatever the
  // select returned: a column the database is missing arrives as undefined and
  // would seed the editor with it, leaving the input uncontrolled and blowing
  // up the commit. Normalising here covers every caller, now and later.
  function startEdit(target: EditTarget, initial: string | null | undefined) {
    setEditValue(initial ?? "");
    setEditTarget(target);
  }

  function commit() {
    if (!editTarget) return;

    const trimmed = editValue.trim();
    setEditTarget(null);

    if (editTarget === "name") {
      if (trimmed && trimmed !== lesson.name) onRenameLesson(lesson.id, trimmed);
    } else if (editTarget === "description" && trimmed !== (lesson.description ?? "")) {
      onUpdateLessonDescription(lesson.id, trimmed || null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setEditTarget(null);
    }
  }

  const editor = (maxLength: number) => (
    <input
      ref={inputRef}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      maxLength={maxLength}
      className="w-full rounded border border-brand bg-surface px-2 py-0.5 text-sm text-fg outline-none"
    />
  );

  return (
    <div
      data-lesson-id={lesson.id}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-2.5 transition-all",
        isSource && "border-brand/50 bg-brand/5",
        isSwapTarget && "border-brand/60 ring-2 ring-brand/40",
        isFlash && "curriculum-flash",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-medium text-muted-fg shrink-0">
            {mod.sequence_order}.{lesson.sequence_order}
          </span>
          {editTarget === "name" ? (
            editor(255)
          ) : (
            <>
              <span
                role="button"
                tabIndex={0}
                title="Edit lesson name"
                className="cursor-pointer rounded px-1 py-0.5 text-sm text-fg transition-colors hover:bg-muted"
                onClick={() => startEdit("name", lesson.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startEdit("name", lesson.name);
                }}
              >
                {lesson.name}
              </span>
              <button
                type="button"
                onClick={() => startEdit("name", lesson.name)}
                aria-label="Rename lesson"
                title="Rename lesson"
                className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
              >
                <span className="material-symbols-rounded text-[14px]">edit</span>
              </button>
            </>
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

      <div className="flex items-center gap-2.5 pl-6 pr-1 min-w-0">
        {editTarget === "description" ? (
          editor(140)
        ) : (
          <>
            <span
              role="button"
              tabIndex={0}
              title="Edit description"
              className="cursor-pointer rounded px-1 py-0.5 text-xs text-muted-fg transition-colors hover:bg-muted"
              onClick={() => startEdit("description", lesson.description)}
              onKeyDown={(e) => {
                if (e.key === "Enter") startEdit("description", lesson.description);
              }}
            >
              {lesson.description || <span className="italic">Add description</span>}
            </span>
            <button
              type="button"
              onClick={() => startEdit("description", lesson.description)}
              aria-label="Edit lesson description"
              title="Edit lesson description"
              className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
            >
              <span className="material-symbols-rounded text-[14px]">edit</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
