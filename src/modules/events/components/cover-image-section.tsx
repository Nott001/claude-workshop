"use client";

import { useRef } from "react";
import { SectionCard } from "@/shared/components/section-card";
import { acceptAttribute, maxSizeMb } from "@/shared/integrations/storage/policy";

interface CoverImageSectionProps {
  /** What to show above the picker: an uploaded URL, a local preview, or nothing. */
  previewUrl: string | null;
  /** Blocks the input while an upload is in flight. */
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onFilePicked: (file: File) => void;
}

/**
 * The cover section, wherever an event's cover is set — its own card, its own
 * heading, and no opinion on what happens to the file.
 *
 * Two callers want the same section on different timing: an existing event
 * uploads on pick, while a form for an event that has no row yet cannot, since
 * the object path is keyed on the event id. Only the handler differs, so only
 * the handler is theirs — the heading and the copy under it are stated once, or
 * the create form and the event's own Details tab drift into two sections that
 * do the same thing in different words.
 */
export function CoverImageSection({
  previewUrl,
  busy = false,
  busyLabel = "Uploading...",
  error,
  onFilePicked,
}: CoverImageSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // The path is `cover.<ext>`, so re-picking the same filename is normal.
    // Without this the input holds the old value and fires no change event.
    if (inputRef.current) inputRef.current.value = "";
    if (file) onFilePicked(file);
  }

  return (
    <SectionCard title="Cover image" icon="image" description="Shown on event cards across the site.">
      {previewUrl ? (
        /* Covers are served through /api/storage, which next/image cannot fetch without a custom loader. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Event cover"
          className="mb-3 aspect-[1.85] w-full rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="mb-3 grid aspect-[1.85] w-full place-items-center rounded-lg border border-dashed border-border text-xs text-muted-fg">
          No cover image yet
        </div>
      )}

      <label
        htmlFor="event-cover-input"
        className="inline-block cursor-pointer rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 aria-disabled:opacity-50"
        aria-disabled={busy}
      >
        {busy ? busyLabel : previewUrl ? "Replace image" : "Upload image"}
      </label>
      <input
        id="event-cover-input"
        ref={inputRef}
        type="file"
        accept={acceptAttribute("event_images")}
        onChange={handleFileChange}
        disabled={busy}
        className="sr-only"
      />

      <p className="mt-2 text-xs text-muted-fg">JPEG or PNG, up to {maxSizeMb("event_images")} MB.</p>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </SectionCard>
  );
}
