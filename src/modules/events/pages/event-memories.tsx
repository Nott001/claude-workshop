"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useEvent } from "@/modules/events/lib/use-event";
import { useEventPhotoList } from "@/modules/events/lib/use-event-photos";
import { EventGallery } from "@/modules/events/components/event-gallery";
import { BackLink } from "@/shared/components/back-link";
import { CardCta } from "@/shared/components/card-cta";
import { resolveBackLink, withBackLink, toBackLinkOrigin } from "@/shared/lib/back-link";
import { formatEventDate } from "@/shared/lib/date-utils";

/**
 * One finished event's photographs, as their own page.
 *
 * The memories strip used to land on the event's detail page, which is a page
 * about an event that has not happened yet — a register card, a schedule, a
 * map — and the photographs were a section under all of it. Following "view 12
 * photos" and arriving at a sold-out registration form is the redundancy the
 * strip was supposed to stop being.
 *
 * So the archive gets its own route and leads with the pictures. The event
 * itself is one line of context and a link, rather than the other way round.
 */
export function EventMemoriesPage({ from }: { from?: string }) {
  const params = useParams();
  const eventId = String(params.id);
  const origin = toBackLinkOrigin(from);
  const backLink = resolveBackLink(from);

  const { event, loading: eventLoading, error } = useEvent(eventId);
  const { photos, loading: photosLoading } = useEventPhotoList(eventId);

  const loading = eventLoading || photosLoading;

  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <div className="mx-auto w-full max-w-page px-5 py-12 sm:px-8">
        <BackLink href={backLink.href} className="mb-6">
          {backLink.label}
        </BackLink>

        {loading ? (
          <p className="text-sm text-muted-fg">Loading photos...</p>
        ) : error || !event ? (
          <p className="text-sm text-error">This event could not be found.</p>
        ) : (
          <>
            <header>
              <p className="text-xs font-semibold tracking-[0.1em] text-muted-fg uppercase">Event memories</p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em]">{event.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-fg">
                <span>{formatEventDate(event.event_date)}</span>
                <span aria-hidden>&middot;</span>
                <span>{event.venue_name}</span>
              </p>

              {/* The event is context here, not the destination — one link out
                  for a reader who wants the schedule or the speakers, rather
                  than a page of them wrapped around the photographs. */}
              <Link href={withBackLink(`/events/${eventId}`, origin)} className="mt-4 inline-block hover:underline">
                <CardCta>View event details</CardCta>
              </Link>
            </header>

            <div className="mt-10">
              {photos.length > 0 ? (
                <EventGallery photos={photos} />
              ) : (
                // A routine destination, not an edge case: the memories strip
                // links here whether or not anything has been uploaded, because
                // an empty archive is an answer and being redirected to the
                // event page instead is not.
                <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
                  <span aria-hidden className="material-symbols-rounded text-3xl text-muted-fg">
                    photo_library
                  </span>
                  <p className="mt-2 text-sm font-medium">No photos from this event yet</p>
                  <p className="mt-1 text-sm text-muted-fg">They appear here once the team has uploaded them.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
