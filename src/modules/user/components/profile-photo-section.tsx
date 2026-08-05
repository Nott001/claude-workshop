"use client";

import { useRef } from "react";
import { Button } from "@/shared/components/ui/button";

interface ProfilePhotoSectionProps {
  previewUrl?: string | null;
  uploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProfilePhotoSection({ previewUrl, uploading, onChange }: ProfilePhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-bold text-fg">Profile Photo</h2>
      <p className="mt-1 text-xs text-muted-fg">JPEG or PNG, up to 50 MB.</p>
      <div className="mt-4 flex items-center gap-4">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="material-symbols-rounded text-2xl text-muted-fg">person</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading\u2026" : "Upload photo"}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
