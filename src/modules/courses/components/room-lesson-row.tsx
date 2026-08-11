"use client";

import type { Lesson } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { contentTypeMeta } from "@/modules/courses/lib/content-type-meta";

interface RoomLessonRowProps {
  lesson: Lesson;
  isHighlighted: boolean;
  isStaff: boolean;
  settingHighlight: boolean;
  onToggleHighlight: () => void;
}

export function RoomLessonRow({ lesson, isHighlighted, isStaff, settingHighlight, onToggleHighlight }: RoomLessonRowProps) {
  const { icon } = contentTypeMeta(lesson.content_type);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-fg",
        isHighlighted && "border-brand ring-1 ring-brand",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {lesson.content_url ? (
          <a
            href={lesson.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 text-muted-fg transition-colors hover:text-brand"
          >
            <span className="material-symbols-rounded shrink-0 text-[14px]">{icon}</span>
            <span className="truncate">{lesson.description}</span>
          </a>
        ) : (
          <span className="flex min-w-0 items-center gap-2 text-muted-fg/60">
            <span className="material-symbols-rounded shrink-0 text-[14px]">{icon}</span>
            <span className="truncate">{lesson.description}</span>
          </span>
        )}
        {isHighlighted && <span className="shrink-0 text-[10px] font-bold uppercase text-brand">Current</span>}
      </div>

      {isStaff && (
        <button
          onClick={onToggleHighlight}
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors",
            isHighlighted ? "bg-brand text-white" : "bg-muted text-muted-fg hover:bg-brand/10 hover:text-brand",
          )}
          disabled={settingHighlight}
        >
          {isHighlighted ? "Highlighted" : "Highlight"}
        </button>
      )}
    </div>
  );
}
