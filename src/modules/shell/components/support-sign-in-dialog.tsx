"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import { SignInPrompt } from "@/modules/support/components/sign-in-prompt";

interface SupportSignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Gate shown before the chat panel when a signed-out visitor clicks the
 * floating assist button. Signing in or up carries redirect_url, so the visit
 * lands back on the same page afterwards.
 */
export function SupportSignInDialog({ open, onOpenChange }: SupportSignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-center">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-base leading-6 font-bold text-fg">Message support</DialogTitle>
        </DialogHeader>
        <SignInPrompt />
      </DialogContent>
    </Dialog>
  );
}
