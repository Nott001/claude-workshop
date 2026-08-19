"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventPhoto } from "@/shared/types";

/**
 * A finished event's photographs, as a grid that opens into a full-screen
 * viewer. Pure: it is handed the photos rather than fetching them, so the
 * memories page owns the read and a test can hand it a list.
 *
 * Renders nothing at all — not an empty state — when there is no archive. The
 * page above it says that better, with room to explain why.
 */
export function EventGallery({ photos }: { photos: EventPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // The thumbnail that opened the viewer, captured from the click rather than
  // read off `document.activeElement` — a click does not necessarily leave
  // focus on the button it hit, and by cleanup time focus is inside the dialog.
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    openerRef.current?.focus();
  }, []);

  if (photos.length === 0) return null;

  return (
    <section aria-labelledby="event-gallery-heading">
      <h2 id="event-gallery-heading" className="text-xl font-bold text-fg">
        Photos
      </h2>
      <p className="mt-1 text-sm text-muted-fg">
        {photos.length} {photos.length === 1 ? "photo" : "photos"} from this event.
      </p>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={(e) => {
                openerRef.current = e.currentTarget;
                setOpenIndex(index);
              }}
              className="group block w-full overflow-hidden rounded-xl border border-border focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {/* Served through /api/storage, which next/image cannot fetch without a custom loader. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt={photo.caption ?? "Photo from this event"}
                // Below the fold on every viewport, and there can be dozens.
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && <PhotoLightbox photos={photos} index={openIndex} onChange={setOpenIndex} onClose={close} />}
    </section>
  );
}

interface PhotoLightboxProps {
  photos: EventPhoto[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

function PhotoLightbox({ photos, index, onChange, onClose }: PhotoLightboxProps) {
  const photo = photos[index];
  const closeRef = useRef<HTMLButtonElement>(null);

  const step = useCallback(
    (delta: number) => onChange((index + delta + photos.length) % photos.length),
    [index, onChange, photos.length],
  );

  useEffect(() => {
    // Arrow keys and Escape, because this is a full-screen viewer and a reader
    // paging through a set of photos reaches for them before a hit target.
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", handleKey);

    // The page behind must not scroll while the overlay owns the viewport.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus moves into the overlay. Without this a keyboard reader is still
    // standing on the thumbnail behind a full-screen dialog, and Tab walks the
    // page underneath it. Returning focus is the gallery's job — it is the one
    // that knows which thumbnail was clicked.
    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, step]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? "Event photo"}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 backdrop-blur-sm"
      // Only the backdrop closes: the click is stopped on the figure below, so
      // dragging to select a caption does not dismiss the photo.
      onClick={onClose}
    >
      <div className="flex justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden className="material-symbols-rounded">
            close
          </span>
        </button>
      </div>

      <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.image_url}
          alt={photo.caption ?? "Photo from this event"}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
        {photo.caption && <figcaption className="max-w-2xl text-center text-sm text-white/80">{photo.caption}</figcaption>}
      </figure>

      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-6 pt-4" onClick={(e) => e.stopPropagation()}>
          <LightboxStep label="Previous photo" icon="chevron_left" onClick={() => step(-1)} />
          <span className="text-sm tabular-nums text-white/70">
            {index + 1} / {photos.length}
          </span>
          <LightboxStep label="Next photo" icon="chevron_right" onClick={() => step(1)} />
        </div>
      )}
    </div>
  );
}

function LightboxStep({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      <span aria-hidden className="material-symbols-rounded">
        {icon}
      </span>
    </button>
  );
}
