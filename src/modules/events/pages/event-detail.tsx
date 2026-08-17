"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { resolveBackLink, toBackLinkOrigin } from "@/shared/lib/back-link";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import { EventDetailHero } from "@/modules/events/components/event-detail-hero";
import { EventSchedule } from "@/modules/events/components/event-schedule";
import { EventSpeakerCard } from "@/modules/events/components/event-speaker-card";
import { EventRegisterCard } from "@/modules/events/components/event-register-card";
import { EventMapCard } from "@/modules/events/components/event-map-card";
import { EventShare } from "@/modules/events/components/event-share";
import { BackLink } from "@/shared/components/back-link";

export function EventDetailPage({ from }: { from?: string }) {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const backOrigin = toBackLinkOrigin(from);
  const { event, loading, error, badgeProps, hasTicket, isSignedIn, handleRegister } = useEventDetail(eventId, backOrigin);
  const backLink = resolveBackLink(backOrigin);

  useEffect(() => {
    if (user && user.role !== ROLES.ATTENDEE) {
      router.replace(`/staff/events/${eventId}`);
    }
  }, [user, eventId, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">{error ?? "Event not found"}</div>
      </div>
    );
  }

  const speakers = event.EVENT_SPEAKER.map((entry) => entry.SPEAKER_PROFILE).filter(
    (profile): profile is NonNullable<typeof profile> => profile != null,
  );

  return (
    <div className="flex flex-1 flex-col bg-bg">
      {/* Gutters stay at sm:px-8. Widening them at lg would take width back off
          the content on any viewport narrower than the cap, where the cap is
          not what is limiting the layout in the first place.

          The cap is `--container-page`, shared with the staff pages: a
          non-attendee opening this page is redirected to the staff view of the
          same event, and the journey should not change shape halfway. */}
      <div className="mx-auto w-full max-w-page px-5 py-12 sm:px-8">
        <BackLink href={backLink.href} className="mb-6">
          {backLink.label}
        </BackLink>

        <EventDetailHero event={event} badgeLabel={badgeProps?.label ?? event.status} />
        {/* fr, not %: gap is added to the tracks rather than taken out of them,
            so 65%+35% plus a 24px gap overflowed the container by exactly the
            gap and hung the sticky column past the hero's right edge. */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[65fr_35fr]">
          <div className="min-w-0 space-y-6">
            {event.description && (
              <div className="rounded-xl border border-border bg-surface p-6 sm:p-7">
                <h2 className="text-lg font-bold">About this event</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-fg">{event.description}</p>
              </div>
            )}
            <EventSchedule eventId={eventId} event={event} />
            {speakers.length > 0 && (
              <div>
                <h2 className="text-lg font-bold">Speakers</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {speakers.map((speaker) => (
                    <EventSpeakerCard key={speaker.id} speaker={speaker} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="space-y-6 self-start lg:sticky lg:top-24">
            <EventRegisterCard event={event} hasTicket={hasTicket} isSignedIn={isSignedIn} onRegister={handleRegister} />
            <EventMapCard event={event} />
            <EventShare />
          </aside>
        </div>
      </div>
    </div>
  );
}
