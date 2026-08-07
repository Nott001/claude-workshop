import { cn } from "@/shared/lib/utils";
import type { Lesson } from "@/shared/types";
import type { LessonMoveInfo, ModuleMoveInfo, MoveDirection } from "../lib/reorder";

interface MoveButtonProps {
  direction: MoveDirection;
  label: string;
  disabled?: boolean;
  onPreview: () => void;
  onPreviewEnd: () => void;
  onClick: () => void;
}

export function MoveButton({ direction, label, disabled = false, onPreview, onPreviewEnd, onClick }: MoveButtonProps) {
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

export function lessonMoveLabel(lesson: Lesson, info: LessonMoveInfo): string {
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

export function moduleMoveLabel(info: ModuleMoveInfo): string {
  if (!info.possible) {
    return `Cannot move module ${info.direction}`;
  }
  return info.direction === "up" ? `Move module above ${info.targetModuleName}` : `Move module below ${info.targetModuleName}`;
}
