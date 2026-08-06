"use client";

import type { RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import type { ModuleMoveInfo, MoveDirection } from "../lib/reorder";
import type { RowIssue, ScheduleWindow } from "../lib/scheduling";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import { moduleMoveLabel, MoveButton } from "./move-button";
import { ModuleScheduleEditor } from "./module-schedule-editor";
import type { TimeField } from "./session-time-picker";

interface ModuleHeaderProps {
  mod: ModuleWithLessons;
  isQa: boolean;
  conflicting: boolean;
  renaming: boolean;
  renameValue: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  upInfo: ModuleMoveInfo;
  downInfo: ModuleMoveInfo;
  onPreviewMove: (direction: MoveDirection) => void;
  onPreviewMoveEnd: () => void;
  onMove: (direction: MoveDirection) => void;
  onDelete: () => void;
  working: ScheduleWindow[];
  eventSpeakers: CourseSpeaker[];
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  startValue: string;
  endValue: string;
  issue: RowIssue | null;
  onTimeChange: (field: TimeField, value: string) => void;
  onSpeakerChange: (speakerProfileId: number | null) => void;
}

export function ModuleHeader({
  mod,
  isQa,
  conflicting,
  renaming,
  renameValue,
  renameInputRef,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  upInfo,
  downInfo,
  onPreviewMove,
  onPreviewMoveEnd,
  onMove,
  onDelete,
  working,
  eventSpeakers,
  eventStartTime,
  eventEndTime,
  startValue,
  endValue,
  issue,
  onTimeChange,
  onSpeakerChange,
}: ModuleHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("material-symbols-rounded text-lg", isQa ? "text-warning" : "text-info")}>
        {isQa ? "forum" : "menu_book"}
      </span>
      {renaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => onRenameValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          onBlur={onCommitRename}
          className="rounded-lg border border-brand bg-surface px-3 py-1.5 text-sm font-semibold text-fg outline-none ring-2 ring-ring/20"
        />
      ) : (
        <span className="text-sm font-semibold text-fg">{mod.module_name}</span>
      )}

      <button
        onClick={onStartRename}
        className="rounded-md p-1 text-muted-fg transition-colors hover:bg-muted hover:text-fg"
        title="Rename module"
      >
        <span className="material-symbols-rounded text-[14px]">edit</span>
      </button>

      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          isQa ? "bg-warning/10 text-warning" : "bg-info/10 text-info",
        )}
      >
        {isQa ? "Q&A Module" : `${mod.LESSONS.length} ${mod.LESSONS.length === 1 ? "lesson" : "lessons"}`}
      </span>

      <ModuleScheduleEditor
        mod={mod}
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

      {conflicting && (
        <span className="material-symbols-rounded text-[16px] text-warning" title="Session overlaps another module">
          warning
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <MoveButton
          direction="up"
          label={moduleMoveLabel(upInfo)}
          disabled={!upInfo.possible}
          onPreview={() => onPreviewMove("up")}
          onPreviewEnd={onPreviewMoveEnd}
          onClick={() => onMove("up")}
        />
        <MoveButton
          direction="down"
          label={moduleMoveLabel(downInfo)}
          disabled={!downInfo.possible}
          onPreview={() => onPreviewMove("down")}
          onPreviewEnd={onPreviewMoveEnd}
          onClick={() => onMove("down")}
        />
        <button
          onClick={onDelete}
          className="rounded-md p-1 text-muted-fg transition-colors hover:bg-error/10 hover:text-error"
          title="Delete module"
        >
          <span className="material-symbols-rounded text-[14px]">delete</span>
        </button>
      </div>
    </div>
  );
}
