"use client";

import Link from "next/link";

import { useEventPhotoList } from "@/modules/events/lib/use-event-photos";
import { withBackLink, type BackLinkOrigin } from "@/shared/lib/back-link";
import { CardCta } from "@/shared/components/card-cta";

/** The strip on the event's own page. More than this and the section stops
 *  being a pointer to the archive and becomes a second copy of it. */
const PREVIEW_TILES = 4;

/**
 * The photographs on the event's own page: a strip, and a way through to the
 * archive.
 *
 * Not the whole gallery. The archive has its own route, and rendering every
 * photograph in both places is one set of pictures maintained as two surfaces —
 * so this page shows that there are pictures and the other page shows them.
 *
 * Mounted only for a finished event, so an upcoming one never pays for the
 * request. Splitting the fetch from the rendering keeps `EventGallery` a pure
 * view a test can hand a list of photos to.
 */
export function EventGalleryPreview({ eventId, backOrigin }: { eventId: string; backOrigin?: BackLinkOrigin }) {
  const { photos, loading } = useEventPhotoList(eventId);

  const tiles = photos.slice(0, PREVIEW_TILES);
  const remaining = photos.length - tiles.length;

  // Only while the archive is still being read. Rendering the empty state
  // first would say "no photos" to every reader for the length of a request,
  // and then contradict itself.
  if (loading) return null;

  return (
    <section aria-labelledby="event-photos-heading" className="rounded-xl border border-border bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="event-photos-heading" className="text-lg font-bold">
          Photos
        </h2>
        {/* Only where it leads somewhere. "View all 0" is an invitation into an
            empty room; the section below already says the room is empty. */}
        {photos.length > 0 && (
          <Link href={withBackLink(`/events/${eventId}/memories`, backOrigin)} className="hover:underline">
            <CardCta>View all {photos.length}</CardCta>
          </Link>
        )}
      </div>

      {photos.length === 0 ? (
        // Shown rather than hidden. A finished event has an archive whether or
        // not anyone has filled it yet, and a section that vanishes leaves the
        // reader unable to tell "no photos" from "this event never had any".
        <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-border py-10 text-center">
          <span aria-hidden className="material-symbols-rounded text-3xl text-muted-fg">
            photo_library
          </span>
          <p className="mt-2 text-sm text-muted-fg">No photos from this event yet.</p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((photo, index) => (
            <li key={photo.id} className="relative">
              {/* Served through /api/storage, which next/image cannot fetch without a custom loader. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt={photo.caption ?? "Photo from this event"}
                loading="lazy"
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              {/* The count sits on the last tile rather than in a fifth one, so
                the strip is the same shape whether or not there is an overflow. */}
              {index === tiles.length - 1 && remaining > 0 && (
                <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/55 text-lg font-bold text-white">
                  +{remaining}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
