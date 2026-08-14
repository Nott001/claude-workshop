"use client";

import { useState } from "react";
import { useSession } from "@/modules/auth/components/session-context";
import GlobalSupportChat from "@/modules/support/components/global-support-chat";
import { SupportSignInDialog } from "@/modules/shell/components/support-sign-in-dialog";

export function FloatingAssistButton() {
  const [hovered, setHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);
  const { user, isLoaded } = useSession();

  function handleClick() {
    // Waiting on the session avoids a flash of the wrong gate for a visitor
    // who taps before authentication has resolved.
    if (!isLoaded) return;
    if (user) {
      setIsOpen((prev) => !prev);
    } else {
      setShowSignInDialog(true);
    }
  }

  return (
    <>
      <GlobalSupportChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <SupportSignInDialog open={showSignInDialog} onOpenChange={setShowSignInDialog} />
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
          onClick={handleClick}
          className="flex size-14 items-center justify-center rounded-full bg-brand shadow-[0_8px_10px_-6px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.1)] transition-transform hover:scale-105"
          aria-label="Ask for assistance"
        >
          <span className="material-symbols-rounded text-[24px] text-brand">headset_mic</span>
        </button>
      </div>
    </>
  );
}
