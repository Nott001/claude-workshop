"use client";

import { useEffect, useState } from "react";
import { parseLocalDateTime } from "@/shared/lib/date-utils";

interface CountdownTimerProps {
  eventDate: string;
  startTime: string;
  light?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(eventDate: string, startTime: string): TimeLeft | null {
  const target = parseLocalDateTime(eventDate, startTime);
  if (!target) return null;
  const now = new Date();
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function CountdownTimer({ eventDate, startTime, light }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => computeTimeLeft(eventDate, startTime));

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(computeTimeLeft(eventDate, startTime));
    }, 1000);
    return () => clearInterval(id);
  }, [eventDate, startTime]);

  if (!timeLeft) return null;

  const units: { value: string; label: string }[] = [
    { value: pad(timeLeft.days), label: "DAYS" },
    { value: pad(timeLeft.hours), label: "HRS" },
    { value: pad(timeLeft.minutes), label: "MINS" },
    { value: pad(timeLeft.seconds), label: "SECS" },
  ];

  return (
    <div className="flex items-center gap-4">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold tracking-tight ${light ? "text-white" : "text-fg"}`}>{unit.value}</div>
            <div className={`text-[10px] font-bold uppercase tracking-[0.05em] ${light ? "text-white/70" : "text-muted-fg"}`}>
              {unit.label}
            </div>
          </div>
          {i < units.length - 1 && <div className={`pb-4 text-2xl font-bold ${light ? "text-white" : "text-fg"}`}>:</div>}
        </div>
      ))}
    </div>
  );
}
