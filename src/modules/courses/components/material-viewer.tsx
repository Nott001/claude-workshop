"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import { Button } from "@/shared/components/button";
import type { ContentType } from "@/shared/types";

export interface ViewerTarget {
  name: string;
  contentType: ContentType;
  url: string;
}

function Frame({ target }: { target: ViewerTarget }) {
  switch (target.contentType) {
    case "image":
      // next/image cannot fetch an entitlement-gated /api/storage route without
      // remotePatterns, and a modal viewer is never the page's LCP element.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={target.url} alt={target.name} className="mx-auto h-full w-full object-contain" />;
    case "video":
      return <video src={target.url} controls className="mx-auto h-full w-full object-contain" />;
    default:
      // PDFs are same-origin through /api/storage, so they frame reliably.
      // External links often do not — hence the escape hatch in the header.
      return <iframe src={target.url} title={target.name} className="h-full w-full border-0 bg-surface" />;
  }
}

export function MaterialViewer({ target, onClose }: { target: ViewerTarget | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <DialogContent className="flex h-[85vh] flex-col gap-3 p-5 sm:max-w-5xl">
          <DialogHeader className="pr-10">
            <DialogTitle className="truncate">{target.name}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.open(target.url, "_blank", "noopener,noreferrer")}>
                <span aria-hidden className="material-symbols-rounded text-[14px]">
                  open_in_new
                </span>
                Open in new tab
              </Button>
              {target.contentType === "link" && (
                // Framing is the reader's request, but a site that sends
                // X-Frame-Options renders blank in here with no error of its
                // own — so say so rather than leave an empty rectangle.
                <span className="text-xs text-muted-fg">Some sites refuse to be embedded; use the button if blank.</span>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted p-2">
            <Frame target={target} />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
