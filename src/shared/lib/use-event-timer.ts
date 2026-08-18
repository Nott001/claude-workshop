"use client";

import { useEffect, useState } from "react";
import { parseLocalDateTime } from "@/shared/lib/date-utils";

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useEventTimer(eventDate: string, startTime: string, endTime: string) {
  const [elapsed, setElapsed] = useState("00:00:00");
  const [remaining, setRemaining] = useState("--:--:--");

  useEffect(() => {
    if (!eventDate || !startTime) return;
    // Returns true once the session end has passed, so the caller can stop
    // the interval instead of ticking identical clamped values forever.
    function tick(): boolean {
      const start = parseLocalDateTime(eventDate, startTime);
      if (!start) return false;
      const end = endTime ? parseLocalDateTime(eventDate, endTime) : null;
      const now = new Date();

      if (end && now.getTime() >= end.getTime()) {
        setElapsed(formatDuration(Math.max(0, end.getTime() - start.getTime())));
        setRemaining("00:00:00");
        return true;
      }

      const elapsedMs = now.getTime() - start.getTime();
      if (elapsedMs > 0) {
        setElapsed(formatDuration(elapsedMs));
      }

      if (end) {
        setRemaining(formatDuration(end.getTime() - now.getTime()));
      }
      return false;
    }
    if (tick()) return () => {};
    const id = setInterval(() => {
      if (tick()) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [eventDate, startTime, endTime]);

  return { elapsed, remaining };
}
