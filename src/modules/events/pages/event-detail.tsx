"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import { EventDetailHero } from "@/modules/events/components/event-detail-hero";
import { EventSchedule } from "@/modules/events/components/event-schedule";
import { EventSpeakerCard } from "@/modules/events/components/event-speaker-card";
import { EventRegisterCard } from "@/modules/events/components/event-register-card";
import { EventMapCard } from "@/modules/events/components/event-map-card";
import { EventShare } from "@/modules/events/components/event-share";

export function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { user } = useSession();
  const { event, loading, error, badgeProps, hasTicket, isSignedIn, handleRegister } = useEventDetail(eventId);

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
  const speakerName = speakers.map((s) => s.USER?.full_name ?? null).find((name) => name != null) ?? null;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[1120px] px-5 py-12 sm:px-8">
        <EventDetailHero
          event={event}
          badgeLabel={badgeProps?.label ?? event.status}
          speakerName={speakerName}
          onRegister={handleRegister}
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[65%_35%]">
          <div className="min-w-0 space-y-6">
            {event.description && (
              <div className="rounded-xl border border-border bg-surface p-6 sm:p-7">
                <h2 className="text-lg font-bold">About this event</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-fg">{event.description}</p>
              </div>
            )}
            <EventSchedule eventId={eventId} />
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
