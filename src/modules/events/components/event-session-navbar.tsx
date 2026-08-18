"use client";

import { useEffect, useState } from "react";
import { parseLocalDateTime } from "@/shared/lib/date-utils";

interface EventSessionNavbarProps {
  eventName: string;
  elapsed: string;
  remaining: string;
  eventDate: string;
  startTime: string;
  hasEnded?: boolean;
  liveModuleName?: string | null;
  liveSpeakerName?: string | null;
  onExit?: () => void;
}

export function EventSessionNavbar({
  eventName,
  elapsed,
  remaining,
  eventDate,
  startTime,
  hasEnded = false,
  liveModuleName,
  liveSpeakerName,
  onExit,
}: EventSessionNavbarProps) {
  const [startsIn, setStartsIn] = useState("");

  useEffect(() => {
    if (!eventDate || !startTime) return;
    function tick() {
      const start = parseLocalDateTime(eventDate, startTime);
      if (!start) return;
      const now = new Date();
      const diff = start.getTime() - now.getTime();
      if (diff > 0) {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) {
          setStartsIn(`${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
        } else {
          setStartsIn(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
        }
      } else {
        setStartsIn("");
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [eventDate, startTime]);

  const sessionStart = eventDate && startTime ? parseLocalDateTime(eventDate, startTime) : null;
  const eventStarted = !!sessionStart && sessionStart <= new Date();

  return (
    <div className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
            <span className="material-symbols-rounded text-[20px]">bolt</span>
          </span>
          <span className="text-base font-bold text-fg">StartupLab</span>
        </div>
        <div className="flex items-center pl-4">
          <span className="text-sm font-bold tracking-[0.7px] text-brand">{eventName}</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4">
        {hasEnded ? (
          <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Ended</span>
        ) : eventStarted ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center border-r border-border pr-4">
              <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Elapsed</span>
              <span className="font-mono text-base font-bold leading-6 text-brand">{elapsed}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Remaining</span>
              <span className="font-mono text-base font-bold leading-6 text-fg">{remaining}</span>
            </div>
          </div>
        ) : startsIn ? (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Starts in</span>
            <span className="font-mono text-base font-bold leading-6 text-fg">{startsIn}</span>
          </div>
        ) : null}

        {!hasEnded && liveModuleName && (
          <div className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1">
            <span className="size-2 animate-pulse rounded-full bg-brand" />
            <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-brand">Live</span>
            <span className="text-sm font-bold text-fg">{liveModuleName}</span>
            {liveSpeakerName && <span className="text-xs text-muted-fg">· {liveSpeakerName}</span>}
          </div>
        )}
      </div>

      <button
        onClick={onExit}
        className="flex items-center gap-2 text-sm font-medium tracking-[0.7px] text-muted-fg transition-colors hover:text-fg"
      >
        <span className="material-symbols-rounded text-base">logout</span>
        EXIT COURSE ROOM
      </button>
    </div>
  );
}
