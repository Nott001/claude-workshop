"use client";

import { useEffect, useState } from "react";
import { parseLocalDateTime } from "@/shared/lib/date-utils";

export function useEventTimer(eventDate: string, startTime: string, endTime: string) {
  const [elapsed, setElapsed] = useState("00:00:00");
  const [remaining, setRemaining] = useState("--:--:--");

  useEffect(() => {
    if (!eventDate || !startTime) return;
    function tick() {
      const start = parseLocalDateTime(eventDate, startTime);
      if (!start) return;
      const end = endTime ? parseLocalDateTime(eventDate, endTime) : null;
      const now = new Date();

      const elapsedMs = now.getTime() - start.getTime();
      if (elapsedMs > 0) {
        const h = Math.floor(elapsedMs / 3600000);
        const m = Math.floor((elapsedMs % 3600000) / 60000);
        const s = Math.floor((elapsedMs % 60000) / 1000);
        setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }

      if (end) {
        const remMs = end.getTime() - now.getTime();
        if (remMs > 0) {
          const h = Math.floor(remMs / 3600000);
          const m = Math.floor((remMs % 3600000) / 60000);
          const s = Math.floor((remMs % 60000) / 1000);
          setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
        } else {
          setRemaining("00:00:00");
        }
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [eventDate, startTime, endTime]);

  return { elapsed, remaining };
}
