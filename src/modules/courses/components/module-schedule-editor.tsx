"use client";

import { cn } from "@/shared/lib/utils";
import { endConflict, startConflict, type RowIssue, type ScheduleWindow } from "../lib/scheduling";
import { buildTimeOptions } from "../lib/schedule-options";
import type { CourseSpeaker, ModuleWithLessons } from "../lib/types";
import { SessionTimePicker, type TimeField } from "./session-time-picker";

interface ModuleScheduleEditorProps {
  mod: ModuleWithLessons;
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

export function ModuleScheduleEditor({
  mod,
  working,
  eventSpeakers,
  eventStartTime,
  eventEndTime,
  startValue,
  endValue,
  issue,
  onTimeChange,
  onSpeakerChange,
}: ModuleScheduleEditorProps) {
  const committedStart = mod.start_time?.slice(0, 5) ?? null;
  const committedEnd = mod.end_time?.slice(0, 5) ?? null;
  const startOptions = buildTimeOptions({
    eventStart: eventStartTime,
    eventEnd: eventEndTime,
    committed: [committedStart],
  }).map((option) => ({ ...option, disabled: startConflict(working, mod.id, option.value) !== null }));
  const endOptions = buildTimeOptions({
    eventStart: eventStartTime,
    eventEnd: eventEndTime,
    committed: [committedEnd],
  }).map((option) => ({ ...option, disabled: endConflict(working, mod.id, option.value) !== null }));

  const fieldLabelClass = "text-[10px] font-semibold uppercase tracking-wider text-muted-fg";

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Session time</span>
          <SessionTimePicker
            modName={mod.module_name}
            startValue={startValue}
            endValue={endValue}
            startOptions={startOptions}
            endOptions={endOptions}
            invalid={issue?.error ?? false}
            onChange={onTimeChange}
          />
        </div>
        {eventSpeakers.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Speaker</span>
            <select
              value={mod.speaker_profile_id ?? ""}
              onChange={(e) => onSpeakerChange(e.target.value === "" ? null : Number(e.target.value))}
              aria-label={`Speaker for ${mod.module_name}`}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-fg outline-none focus:border-brand focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Unassigned</option>
              {eventSpeakers.map((speaker) => (
                <option key={speaker.speaker_profile_id} value={speaker.speaker_profile_id}>
                  {speaker.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {issue && <p className={cn("mt-1.5 text-xs", issue.error ? "text-error" : "text-muted-fg")}>{issue.message}</p>}
    </div>
  );
}
