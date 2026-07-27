"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HeroImageUploaderProps {
  preview: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}

export function HeroImageUploader({ preview, onFileSelect, onRemove }: HeroImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  return (
    <div
      onDrop={handleFileDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
        dragOver ? "border-accent bg-accent/5" : "border-border",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
      {preview ? (
        <div className="relative w-full max-w-md">
          <img src={preview} alt="Hero preview" className="max-h-48 w-full rounded-lg object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        </div>
      ) : (
        <>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2">
            <path
              d="M24 16v12m-6-6h12m10-6v16a4 4 0 01-4 4H12a4 4 0 01-4-4V22a4 4 0 014-4h3l3-4h6m12 0v6"
              stroke="#29B6F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-brand">Upload a hero image</span>
            <span className="text-sm text-muted-fg">or drag and drop</span>
          </div>
          <span className="mt-1 text-xs text-muted-fg">PNG, JPG, GIF up to 10MB</span>
        </>
      )}
    </div>
  );
}
