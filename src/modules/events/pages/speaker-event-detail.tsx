"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { EventDetailHero } from "@/modules/events/components/event-detail-hero";
import { useSpeakerEvent } from "@/modules/events/lib/use-speaker-event";
import { BackLink } from "@/shared/components/back-link";
import { buttonStyles } from "@/shared/components/button";
import { SectionCard } from "@/shared/components/section-card";
import { StaffPage, StaffPageState } from "@/shared/components/staff-page";

export function SpeakerEventDetailPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const { event, loading, error } = useSpeakerEvent(eventId);

  if (loading) {
    return <StaffPageState>Loading event details...</StaffPageState>;
  }

  if (error || !event) {
    return <StaffPageState tone="error">{error ?? "Event not found"}</StaffPageState>;
  }

  return (
    <StaffPage>
      <BackLink href="/speaker/events" className="mb-6">
        Back to My Events
      </BackLink>

      <EventDetailHero event={event} />

      {/* The whole-event speaker actions, above the panels, the same place the
          staff page puts its own. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {event.course_id ? (
          <Link href={`/speaker/events/${eventId}/course`} prefetch={false} className={buttonStyles({ size: "lg" })}>
            <span aria-hidden className="material-symbols-rounded text-[18px]">
              school
            </span>
            Manage Course
          </Link>
        ) : (
          <Link href={`/speaker/events/${eventId}/course`} prefetch={false} className={buttonStyles({ size: "lg" })}>
            <span aria-hidden className="material-symbols-rounded text-[18px]">
              add_circle
            </span>
            Build Course
          </Link>
        )}
        {event.course_id && (
          <Link
            href={`/courses/${event.course_id}/room`}
            prefetch={false}
            className={buttonStyles({ variant: "secondary", size: "lg" })}
          >
            <span aria-hidden className="material-symbols-rounded text-[18px]">
              play_arrow
            </span>
            Enter Course Room
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[65fr_35fr]">
        <div className="min-w-0 space-y-6">
          <SectionCard title="Full Event Description" icon="description">
            {event.description ? (
              <div className="flex flex-col gap-4">
                {event.description.split("\n").map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-fg">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-fg">No description available for this event.</p>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-6 self-start lg:sticky lg:top-24">
          <SectionCard title="Attendees" icon="group">
            <p className="text-4xl font-bold tracking-tight text-brand">{event.attendee_count.toLocaleString()}</p>
            <p className="mt-1 text-sm text-muted-fg">Total registered attendees</p>
          </SectionCard>
        </aside>
      </div>
    </StaffPage>
  );
}
