"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventPhoto } from "@/shared/types";
import { postUpload } from "@/shared/integrations/storage/upload-client";

/**
 * An event's archive, read-only.
 *
 * Its own hook because the public gallery is a reader: handing that page the
 * upload and delete callbacks would ship the curation code to every visitor of
 * every finished event to render a grid of images.
 */
export function useEventPhotoList(eventId: string) {
  // One state object tagged with the event it was loaded for, so `loading` is
  // derived rather than written. Setting it in the effect would both trip the
  // cascading-render rule and lie for one render after `eventId` changes —
  // stale photos with a settled loading flag underneath them.
  const [loaded, setLoaded] = useState<{ eventId: string | null; photos: EventPhoto[]; error: string | null }>({
    eventId: null,
    photos: [],
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/events/${eventId}/photos`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
      .then((body: { data?: EventPhoto[] }) => {
        if (!cancelled) setLoaded({ eventId, photos: body.data ?? [], error: null });
      })
      .catch(() => {
        // A gallery that cannot load is a missing section, not a broken page —
        // every caller renders around it.
        if (!cancelled) setLoaded({ eventId, photos: [], error: "Could not load the photos." });
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const loading = loaded.eventId !== eventId;

  /** Applies a write's result in place. Ignored once the hook has moved on to
   *  another event, whose list this one's rows do not belong to. */
  const setPhotos = useCallback(
    (update: (previous: EventPhoto[]) => EventPhoto[]) =>
      setLoaded((previous) => (previous.eventId === null ? previous : { ...previous, photos: update(previous.photos) })),
    [],
  );

  return { photos: loading ? [] : loaded.photos, setPhotos, loading, error: loading ? null : loaded.error };
}

/**
 * The same archive plus the writes against it, for the staff manager.
 *
 * Each write applies the row the response carries rather than refetching the
 * collection: the server has just said what changed, and re-reading it costs a
 * round trip and flickers a grid of thumbnails through empty on every edit.
 */
export function useEventPhotos(eventId: string) {
  const { photos, setPhotos, loading, error } = useEventPhotoList(eventId);

  /**
   * Uploads one file. Sequential by the caller's choice rather than this hook's:
   * several at once each hold their bytes in the same 128 MB isolate, and the
   * append order is the gallery's order.
   */
  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      const result = await postUpload<EventPhoto>("event_images", `/api/events/${eventId}/photos`, file);
      if (!result.ok) return result.error;

      // Appended, not refetched: the response is the created row, and the
      // service assigns it the sequence number that puts it last.
      setPhotos((prev) => [...prev, result.data]);
      return null;
    },
    [eventId, setPhotos],
  );

  const remove = useCallback(
    async (photoId: number): Promise<string | null> => {
      const res = await fetch(`/api/events/${eventId}/photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return body?.error ?? "Could not remove the photo.";
      }
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      return null;
    },
    [eventId, setPhotos],
  );

  const setCaption = useCallback(
    async (photoId: number, caption: string): Promise<string | null> => {
      const res = await fetch(`/api/events/${eventId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return body?.error ?? "Could not save the caption.";
      }
      const updated: EventPhoto = await res.json();
      setPhotos((prev) => prev.map((photo) => (photo.id === updated.id ? updated : photo)));
      return null;
    },
    [eventId, setPhotos],
  );

  return { photos, loading, error, upload, remove, setCaption };
}
