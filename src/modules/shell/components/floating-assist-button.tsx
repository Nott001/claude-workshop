"use client";

import { useState } from "react";
import GlobalSupportChat from "@/modules/support/components/global-support-chat";

export function FloatingAssistButton() {
  const [hovered, setHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <GlobalSupportChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div
        className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={`whitespace-nowrap rounded-lg bg-surface px-3 py-1.5 text-sm font-extralight text-fg shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          Ask for assistance
        </div>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex size-14 items-center justify-center rounded-full bg-brand shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105"
          aria-label="Ask for assistance"
        >
          <span className="material-symbols-rounded text-[24px] text-brand">headset_mic</span>
        </button>
      </div>
    </>
  );
}
