"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/shared/components/button";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function Drawer({ open, onOpenChange, title, description, children, footer }: DrawerProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
            <div>
              <DialogPrimitive.Title className="text-base leading-none font-bold">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-fg">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon">
                  <span className="material-symbols-rounded">close</span>
                </Button>
              }
            >
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { Drawer };
