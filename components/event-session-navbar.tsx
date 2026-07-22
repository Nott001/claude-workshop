"use client";

import { useEffect, useState } from "react";

interface EventSessionNavbarProps {
  eventName: string;
  elapsed: string;
  remaining: string;
  eventDate: string;
  startTime: string;
  onExit?: () => void;
}

const imgLogo = "https://www.figma.com/api/mcp/asset/90f58a5a-a9a8-4a04-b906-4e4db8c1e19f";
const imgName = "https://www.figma.com/api/mcp/asset/e4435c74-cf7b-49ed-b671-fb21ae21e4b2";
const imgExit = "https://www.figma.com/api/mcp/asset/599c0b3c-da60-4dec-9ad9-adcf004c3fc5";

export function EventSessionNavbar({ eventName, elapsed, remaining, eventDate, startTime, onExit }: EventSessionNavbarProps) {
  const [startsIn, setStartsIn] = useState("");

  useEffect(() => {
    if (!eventDate || !startTime) return;
    function tick() {
      const start = new Date(`${eventDate}T${startTime}`);
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

  const eventStarted = eventDate && startTime ? new Date(`${eventDate}T${startTime}`) <= new Date() : false;

  return (
    <div className="flex h-16 shrink-0 items-center border-b border-[#bdc8d0] bg-white px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src={imgLogo} alt="" className="size-8" />
          <img src={imgName} alt="StartupLab" className="h-8 w-[56.88px]" />
        </div>
        <div className="flex items-center pl-4">
          <span className="text-sm font-bold tracking-[0.7px] text-[#3db9ee]">{eventName}</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4">
        {eventStarted ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center border-r border-[#bdc8d0] pr-4">
              <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-[#5f5e5e]">Elapsed</span>
              <span className="font-mono text-base font-bold leading-6 text-[#068]">{elapsed}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-[#5f5e5e]">Remaining</span>
              <span className="font-mono text-base font-bold leading-6 text-[#1b1c1c]">{remaining}</span>
            </div>
          </div>
        ) : startsIn ? (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-[#5f5e5e]">Starts in</span>
            <span className="font-mono text-base font-bold leading-6 text-[#1b1c1c]">{startsIn}</span>
          </div>
        ) : null}
      </div>

      <button
        onClick={onExit}
        className="flex items-center gap-2 text-sm font-medium tracking-[0.7px] text-[#3e484f] transition-colors hover:text-[#1b1c1c]"
      >
        <img src={imgExit} alt="" className="size-3.5" />
        EXIT EVENT ROOM
      </button>
    </div>
  );
}
