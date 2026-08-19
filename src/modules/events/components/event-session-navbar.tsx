"use client";

import { useEffect, useState } from "react";
import { computeRoomCountdown, type RoomCountdown } from "@/shared/lib/timer-countdown";

interface EventSessionNavbarProps {
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime?: string | null;
  liveModuleName?: string | null;
  liveSpeakerName?: string | null;
  onExit?: () => void;
}

export function EventSessionNavbar({
  eventName,
  eventDate,
  startTime,
  endTime,
  liveModuleName,
  liveSpeakerName,
  onExit,
}: EventSessionNavbarProps) {
  const [countdown, setCountdown] = useState<RoomCountdown>(() =>
    computeRoomCountdown(eventDate, startTime, endTime, new Date()),
  );

  useEffect(() => {
    const snapshot = () => computeRoomCountdown(eventDate, startTime, endTime, new Date());

    // The lazy initializer above already renders the mount-time value; this
    // interval is only for later seconds. Self-clear at terminal states the
    // same way the old hook did, so a window that cannot progress stops
    // ticking. A change to the window re-runs the effect and restarts it.
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const next = snapshot();
      setCountdown(next);
      if (next.ended || (!next.started && !next.startsIn)) {
        clearInterval(id);
        id = undefined;
      }
    };
    id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
    };
  }, [eventDate, startTime, endTime]);

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
        {countdown.ended ? (
          <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Ended</span>
        ) : countdown.started ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center border-r border-border pr-4">
              <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Elapsed</span>
              <span className="font-mono text-base font-bold leading-6 text-brand">{countdown.elapsed}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Remaining</span>
              <span className="font-mono text-base font-bold leading-6 text-fg">{countdown.remaining}</span>
            </div>
          </div>
        ) : countdown.startsIn ? (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-muted-fg">Starts in</span>
            <span className="font-mono text-base font-bold leading-6 text-fg">{countdown.startsIn}</span>
          </div>
        ) : null}

        {!countdown.ended && liveModuleName && (
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
