"use client";

import { useRef, useState } from "react";

import { SectionCard } from "@/shared/components/section-card";
import { Button } from "@/shared/components/button";
import { acceptAttribute, maxSizeMb } from "@/shared/integrations/storage/policy";
import { MAX_CAPTION_LENGTH } from "@/modules/events/lib/schemas";
import { useEventPhotos } from "@/modules/events/lib/use-event-photos";
import type { EventPhoto } from "@/shared/types";

/**
 * The archive behind a finished event, and the only place it is curated.
 *
 * Uploads run one at a time. Each file is held whole in a 128 MB isolate that
 * every concurrent request shares, and picking twenty photos off a phone is the
 * normal case here — firing them together is how that isolate runs out. The
 * sequential loop also makes the upload order the gallery order, which is what
 * someone selecting a morning's photos expects.
 */
export function EventPhotoManager({ eventId }: { eventId: string }) {
  const { photos, loading, error, upload, remove, setCaption } = useEventPhotos(eventId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Cleared before the awaits: re-picking the same files is normal, and the
    // input fires no change event while it still holds them.
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    setUploadError(null);
    setProgress({ done: 0, total: files.length });

    // Collected rather than surfaced one at a time, so twenty files do not
    // overwrite each other's message in the single error slot below.
    const failures: string[] = [];
    for (const [index, file] of files.entries()) {
      const failure = await upload(file);
      if (failure) failures.push(`${file.name}: ${failure}`);
      setProgress({ done: index + 1, total: files.length });
    }

    setProgress(null);
    if (failures.length > 0) {
      setUploadError(failures.length === 1 ? failures[0] : `${failures.length} of ${files.length} photos failed to upload.`);
    }
  }

  const busy = progress !== null;

  return (
    <SectionCard
      title="Event photos"
      icon="photo_library"
      description="Shown as this event's memories once it has finished."
      actions={
        <>
          <label
            htmlFor="event-photos-input"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={busy}
          >
            <span aria-hidden className="material-symbols-rounded text-base!">
              add_photo_alternate
            </span>
            {busy ? `Uploading ${progress.done} of ${progress.total}...` : "Add photos"}
          </label>
          <input
            id="event-photos-input"
            ref={inputRef}
            type="file"
            multiple
            accept={acceptAttribute("event_images")}
            onChange={handleFilesPicked}
            disabled={busy}
            className="sr-only"
          />
        </>
      }
    >
      {uploadError && <p className="mb-3 text-xs text-error">{uploadError}</p>}

      {loading ? (
        <p className="text-sm text-muted-fg">Loading photos...</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : photos.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed border-border py-10 text-center">
          <span aria-hidden className="material-symbols-rounded text-3xl text-muted-fg">
            photo_library
          </span>
          <p className="mt-2 text-sm font-medium text-fg">No photos yet</p>
          <p className="mt-1 text-xs text-muted-fg">JPEG or PNG, up to {maxSizeMb("event_images")} MB each.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              onRemove={() => remove(photo.id)}
              onCaptionChange={(caption) => setCaption(photo.id, caption)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

interface PhotoTileProps {
  photo: EventPhoto;
  onRemove: () => Promise<string | null>;
  onCaptionChange: (caption: string) => Promise<string | null>;
}

function PhotoTile({ photo, onRemove, onCaptionChange }: PhotoTileProps) {
  const [caption, setCaptionValue] = useState(photo.caption ?? "");
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  async function handleRemove() {
    // Two clicks rather than a dialog: a delete here destroys one thumbnail the
    // reader is looking at, and the arming state says so without stealing focus
    // from a grid they are working through.
    if (!armed) {
      setArmed(true);
      return;
    }
    setPending(true);
    setTileError(await onRemove());
    setPending(false);
  }

  async function handleCaptionCommit() {
    if (caption === (photo.caption ?? "")) return;
    setTileError(await onCaptionChange(caption));
  }

  return (
    <li className="flex flex-col gap-2">
      <div className="relative">
        {/* Photos are served through /api/storage, which next/image cannot fetch without a custom loader. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.image_url}
          alt={photo.caption ?? "Event photo"}
          loading="lazy"
          className="aspect-square w-full rounded-lg border border-border object-cover"
        />
        <Button
          type="button"
          variant={armed ? "danger" : "secondary"}
          size="sm"
          disabled={pending}
          onClick={handleRemove}
          onBlur={() => setArmed(false)}
          className="absolute top-2 right-2"
        >
          <span aria-hidden className="material-symbols-rounded text-base!">
            delete
          </span>
          {armed ? "Confirm" : <span className="sr-only">Remove photo</span>}
        </Button>
      </div>

      <input
        type="text"
        value={caption}
        maxLength={MAX_CAPTION_LENGTH}
        placeholder="Add a caption"
        aria-label="Photo caption"
        onChange={(e) => setCaptionValue(e.target.value)}
        // Saved on blur rather than per keystroke: a caption is a whole thought,
        // and a PATCH per character is a write amplification nobody asked for.
        onBlur={handleCaptionCommit}
        className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg placeholder:text-muted-fg focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      />

      {tileError && <p className="text-xs text-error">{tileError}</p>}
    </li>
  );
}
