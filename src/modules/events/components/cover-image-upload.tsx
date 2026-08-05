"use client";

import { useRef, useState } from "react";
import { acceptAttribute, maxSizeMb, validateFileSize, validateFileType } from "@/shared/integrations/storage/policy";
import { resizeImage } from "@/shared/integrations/storage/resize-image";

interface CoverImageUploadProps {
  eventId: string;
  initialUrl: string | null;
  /** Lets the surrounding page reflect the new cover without a refetch. */
  onUploaded?: (url: string) => void;
}

export function CoverImageUpload({ eventId, initialUrl, onUploaded }: CoverImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // The route rejects these too. Checking here saves a 50 MB round trip only
    // to be told the file was never allowed.
    if (!validateFileType("event_images", file.type)) {
      setError("Only JPEG and PNG images are allowed.");
      return;
    }
    if (!validateFileSize("event_images", file.size)) {
      setError(`Image must be under ${maxSizeMb("event_images")} MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", await resizeImage(file));
      formData.append("event_id", eventId);

      const res = await fetch("/api/upload/event-image", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Could not upload image.");
        return;
      }

      setUrl(data.url);
      onUploaded?.(data.url);
    } catch {
      setError("Could not upload image.");
    } finally {
      setUploading(false);
      // The path is `cover.<ext>`, so re-picking the same filename is normal.
      // Without this the input holds the old value and fires no change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {url ? (
        /* Covers are served through /api/storage, which next/image cannot fetch without a custom loader. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Event cover" className="mb-3 aspect-[1.85] w-full rounded-lg border border-border object-cover" />
      ) : (
        <div className="mb-3 grid aspect-[1.85] w-full place-items-center rounded-lg border border-dashed border-border text-xs text-muted-fg">
          No cover image yet
        </div>
      )}

      <label
        htmlFor="event-cover-input"
        className="inline-block cursor-pointer rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 aria-disabled:opacity-50"
        aria-disabled={uploading}
      >
        {uploading ? "Uploading..." : url ? "Replace image" : "Upload image"}
      </label>
      <input
        id="event-cover-input"
        ref={inputRef}
        type="file"
        accept={acceptAttribute("event_images")}
        onChange={handleFileChange}
        disabled={uploading}
        className="sr-only"
      />

      <p className="mt-2 text-xs text-muted-fg">JPEG or PNG, up to {maxSizeMb("event_images")} MB.</p>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
