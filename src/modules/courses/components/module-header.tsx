"use client";

import type { RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/button";
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
  /** The module is open for editing; every control below writes to the draft. */
  editing: boolean;
  saving: boolean;
  /** Draft name while editing, saved name otherwise. */
  name: string;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onNameChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
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
  speakerValue: number | null;
  issue: RowIssue | null;
  onTimeChange: (field: TimeField, value: string) => void;
  onSpeakerChange: (speakerProfileId: number | null) => void;
}

export function ModuleHeader({
  mod,
  isQa,
  conflicting,
  editing,
  saving,
  name,
  nameInputRef,
  onNameChange,
  onEdit,
  onSave,
  onCancel,
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
  speakerValue,
  issue,
  onTimeChange,
  onSpeakerChange,
}: ModuleHeaderProps) {
  const canSave = name.trim() !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("material-symbols-rounded text-lg", isQa ? "text-warning" : "text-info")}>
        {isQa ? "forum" : "menu_book"}
      </span>

      {editing ? (
        // No commit on blur: blur lands before click, so dismissing the editor
        // would save the very edit Cancel exists to discard.
        <input
          ref={nameInputRef}
          value={name}
          aria-label="Module name"
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) onSave();
            if (e.key === "Escape") onCancel();
          }}
          className="rounded-lg border border-brand bg-surface px-3 py-1.5 text-sm font-semibold text-fg outline-none ring-2 ring-ring/20"
        />
      ) : (
        <span className="text-sm font-semibold text-fg">{mod.module_name}</span>
      )}

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
        speakerValue={speakerValue}
        issue={issue}
        disabled={!editing}
        onTimeChange={onTimeChange}
        onSpeakerChange={onSpeakerChange}
      />

      {conflicting && (
        <span aria-hidden className="material-symbols-rounded text-[16px] text-warning" title="Session overlaps another module">
          warning
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {editing ? (
          <>
            <Button size="sm" onClick={onSave} disabled={!canSave || saving}>
              <span aria-hidden className="material-symbols-rounded text-[14px]">
                check
              </span>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <span aria-hidden className="material-symbols-rounded text-[14px]">
                edit
              </span>
              Edit
            </Button>
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
              <span aria-hidden className="material-symbols-rounded text-[14px]">
                delete
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
