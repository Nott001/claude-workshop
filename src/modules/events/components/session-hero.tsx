"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/shared/lib/date-utils";

interface SessionHeroProps {
  title: string;
  startTime: string | null;
  endTime: string | null;
  speakerName?: string | null;
  isLive: boolean;
  hasEnded: boolean;
  progress: number;
}

function statusBadge(isLive: boolean, hasEnded: boolean): { label: string; live: boolean } {
  if (isLive) return { label: "Live now", live: true };
  if (hasEnded) return { label: "Ended", live: false };
  return { label: "Not started", live: false };
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SessionHero({ title, startTime, endTime, speakerName, isLive, hasEnded, progress }: SessionHeroProps) {
  const clock = useClock();
  const clamped = Math.max(0, Math.min(1, progress));
  const badge = statusBadge(isLive, hasEnded);
  const timeRange = startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : null;

  return (
    <div className="rounded-xl bg-fg p-6 text-bg">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-bg/15 px-3 py-1 text-xs font-bold">
          {badge.live && <span className="size-2 animate-pulse rounded-full bg-brand" />}
          {badge.label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-bg/70">{clock}</span>
      </div>

      <h2 className="mt-3 truncate text-xl font-bold">{title}</h2>

      {(speakerName || timeRange) && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-bg/70">
          <span className="material-symbols-rounded text-[16px]">record_voice_over</span>
          {speakerName && <span>{speakerName}</span>}
          {speakerName && timeRange && <span>·</span>}
          {timeRange && <span>{timeRange}</span>}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg/20">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${Math.round(clamped * 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-bg/70">{Math.round(clamped * 100)}%</span>
      </div>
    </div>
  );
}
