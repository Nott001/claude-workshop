"use client";

import { useRef } from "react";
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/shared/lib/utils";

interface ProfilePhotoSectionProps {
  previewUrl?: string | null;
  uploading: boolean;
  deleting: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

const itemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50";

export function ProfilePhotoSection({ previewUrl, uploading, deleting, onChange, onDelete }: ProfilePhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Profile photo"
        className="group relative grid size-14 place-items-center overflow-hidden rounded-full bg-muted outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="material-symbols-rounded text-2xl text-muted-fg">person</span>
        )}
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="material-symbols-rounded text-[24px]">edit</span>
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" side="bottom" sideOffset={8}>
          <Menu.Popup className="min-w-48 rounded-lg border border-border bg-surface p-1 text-sm text-fg shadow-lg">
            <Menu.Item disabled={uploading} onClick={() => fileInputRef.current?.click()} className={cn(itemClass, "text-fg")}>
              <span aria-hidden className="material-symbols-rounded text-[16px]">
                upload
              </span>
              {uploading ? "Uploading\u2026" : "Upload photo"}
            </Menu.Item>
            {previewUrl && (
              <Menu.Item
                disabled={deleting}
                onClick={onDelete}
                className={cn(itemClass, "data-highlighted:bg-error data-highlighted:text-white")}
              >
                <span aria-hidden className="material-symbols-rounded text-[16px]">
                  delete
                </span>
                {deleting ? "Deleting\u2026" : "Delete photo"}
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onChange} />
    </Menu.Root>
  );
}
