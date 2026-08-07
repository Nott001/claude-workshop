import { formatTime } from "@/shared/lib/date-utils";
import type { ModuleWithLessons } from "./types";

export interface ScheduleSource {
  module_name: string;
  start_time: string | null;
  end_time: string | null;
}

// The DAO returns TIME columns as "09:00:00"; the inputs want "09:00".
export function toInputTime(time: string | null): string {
  return time ? time.slice(0, 5) : "";
}

// Committed values overlaid by in-progress edits; this is what the pickers
// validate against, so a half-entered start greys out its options at once.
export function workingRows(
  modules: ModuleWithLessons[],
  drafts: Record<number, { start: string; end: string }>,
): ScheduleWindow[] {
  return modules.map((m) => {
    const draft = drafts[m.id];
    const start = draft ? draft.start : toInputTime(m.start_time);
    const end = draft ? draft.end : toInputTime(m.end_time);
    return {
      id: m.id,
      module_name: m.module_name,
      start_time: start === "" ? null : start,
      end_time: end === "" ? null : end,
    };
  });
}

/**
 * A module's position in the working schedule (committed values overlaid by
 * in-progress edits) used to grey out time options as the user types.
 */
export interface ScheduleWindow {
  id: number;
  module_name: string;
  start_time: string | null;
  end_time: string | null;
}

export type TimeConflict = { kind: "overlap"; other: ScheduleWindow } | { kind: "invalid"; message: string };

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Every pair of modules whose sessions overlap. A session is half-open
 * [start, end): adjacent windows do not overlap, so "09:00-10:00" and
 * "10:00-12:00" pass. Modules missing either time are skipped.
 */
export interface RowIssue {
  message: string;
  error: boolean;
}

/**
 * The problem blocking a module's session, or null when it can be saved. An
 * overlap is a hard error naming the conflicting module; a half-filled pair or
 * an end at or before its start are warnings until the pair completes.
 */
export function rowIssueFor(
  working: ScheduleWindow[],
  overlaps: [ScheduleWindow, ScheduleWindow][],
  id: number,
): RowIssue | null {
  const pair = overlaps.find(([a, b]) => a.id === id || b.id === id);
  if (pair) {
    const other = pair[0].id === id ? pair[1] : pair[0];
    return {
      error: true,
      message: `Overlaps "${other.module_name}" (${formatTime(other.start_time!)} – ${formatTime(other.end_time!)}).`,
    };
  }
  const row = working.find((w) => w.id === id)!;
  if (row.start_time && row.end_time && row.end_time <= row.start_time) {
    return { error: true, message: "The end time must be after the start time." };
  }
  if ((row.start_time === null) !== (row.end_time === null)) {
    return { error: false, message: "Set both times, or leave both unset, to schedule this module." };
  }
  return null;
}

export function findTimeOverlaps<T extends ScheduleSource>(modules: T[]): [T, T][] {
  const sessions = modules
    .filter((m) => m.start_time !== null && m.end_time !== null)
    .map((m) => ({ module: m, start: toMinutes(m.start_time!), end: toMinutes(m.end_time!) }));

  const pairs: [T, T][] = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.start < b.end && b.start < a.end) {
        pairs.push([a.module, b.module]);
      }
    }
  }
  return pairs;
}

// Only windows that are fully known can block a candidate; a module missing
// one edge cannot prove anything about the other.
function windowedOthers(working: ScheduleWindow[], targetId: number): ScheduleWindow[] {
  return working.filter((m) => m.id !== targetId && m.start_time !== null && m.end_time !== null);
}

/**
 * Why a start time cannot be picked for the target, or null when it can.
 * With the target's end known the whole window is checked; without it only a
 * start that falls inside another window is provably blocked — the case where
 * typing 09:50 into a module whose predecessor runs 09:00-10:00 must reject
 * immediately, before the end time has been entered.
 */
export function startConflict(working: ScheduleWindow[], targetId: number, candidate: string): TimeConflict | null {
  const target = working.find((m) => m.id === targetId);
  if (!target) return null;
  const candidateStart = toMinutes(candidate);
  const targetEnd = target.end_time !== null ? toMinutes(target.end_time) : null;

  if (targetEnd !== null && candidateStart >= targetEnd) {
    return { kind: "invalid", message: "The start time must be before the end time." };
  }

  for (const other of windowedOthers(working, targetId)) {
    const otherStart = toMinutes(other.start_time!);
    const otherEnd = toMinutes(other.end_time!);
    if (targetEnd !== null) {
      if (candidateStart < otherEnd && otherStart < targetEnd) return { kind: "overlap", other };
    } else if (otherStart <= candidateStart && candidateStart < otherEnd) {
      return { kind: "overlap", other };
    }
  }
  return null;
}

/**
 * Why an end time cannot be picked for the target, or null when it can.
 * Mirrors startConflict for the closing edge, and blocks an end at or before
 * the target's own start.
 */
export function endConflict(working: ScheduleWindow[], targetId: number, candidate: string): TimeConflict | null {
  const target = working.find((m) => m.id === targetId);
  if (!target) return null;
  const candidateEnd = toMinutes(candidate);
  const targetStart = target.start_time !== null ? toMinutes(target.start_time) : null;

  if (targetStart !== null && candidateEnd <= targetStart) {
    return { kind: "invalid", message: "The end time must be after the start time." };
  }

  for (const other of windowedOthers(working, targetId)) {
    const otherStart = toMinutes(other.start_time!);
    const otherEnd = toMinutes(other.end_time!);
    if (targetStart !== null) {
      if (targetStart < otherEnd && otherStart < candidateEnd) return { kind: "overlap", other };
    } else if (otherStart < candidateEnd && candidateEnd <= otherEnd) {
      return { kind: "overlap", other };
    }
  }
  return null;
}
