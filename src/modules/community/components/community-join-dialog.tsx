"use client";

import { Button } from "@/shared/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import { platformFromUrl } from "@/modules/community/lib/community-platform";

export interface JoinTarget {
  label: string;
  url: string;
}

interface CommunityJoinDialogProps {
  /** The group awaiting confirmation, or `null` when nothing is pending. */
  target: JoinTarget | null;
  onClose: () => void;
}

/**
 * Confirms before a community card hands the visitor off to Facebook, Discord
 * or wherever else the group lives. One dialog serves every card: the page owns
 * the pending target, so the cards stay presentational and only one copy of
 * this markup is ever mounted.
 */
export function CommunityJoinDialog({ target, onClose }: CommunityJoinDialogProps) {
  const platform = target ? platformFromUrl(target.url) : null;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="text-center">
        <DialogHeader className="items-center text-center">
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
            <span className="material-symbols-rounded">open_in_new</span>
          </span>
          <DialogTitle className="text-base font-bold text-fg">Leaving StartupLab</DialogTitle>
        </DialogHeader>

        <DialogDescription className="mt-2 leading-relaxed">
          This group is hosted externally. You&apos;ll be taken{platform ? ` to ${platform.name}` : " to another site"} to join{" "}
          <span className="font-semibold text-fg">{target?.label}</span>.
        </DialogDescription>

        {/* A real anchor rather than a scripted window.open: a pop-up blocker
            cannot swallow it, and it keeps the URL visible on hover. */}
        <a
          href={target?.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 text-sm font-bold text-brand-fg shadow-sm transition-colors hover:bg-brand/90"
        >
          Continue
          <span aria-hidden className="material-symbols-rounded text-base!">
            arrow_outward
          </span>
        </a>

        <DialogClose render={<Button variant="ghost" className="mt-2 w-full" />}>Stay here</DialogClose>
      </DialogContent>
    </Dialog>
  );
}
