"use client";

import { useParams, useRouter } from "next/navigation";
import { Footer } from "@/shared/components/footer";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { event, loading, error, isFacilitator, badgeProps, handleRegister } = useEventDetail(eventId);

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

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-[896px] px-5 py-12 sm:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <span className="mb-2 inline-flex items-center rounded-full bg-info/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand">
              {badgeProps?.label ?? event.status}
            </span>
            <h1 className="text-[32px] font-bold tracking-[-0.02em] text-fg">{event.title}</h1>
            <p className="mt-2 text-sm text-muted-fg">
              {event.event_date} &middot; {event.start_time} - {event.end_time}
            </p>
            {event.venue_name && <p className="mt-1 text-sm text-muted-fg">{event.venue_name}</p>}
          </div>
        </div>

        {event.description && <p className="mb-8 text-sm leading-relaxed text-fg">{event.description}</p>}

        <div className="flex gap-3">
          {!isFacilitator && (
            <button
              onClick={handleRegister}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/80"
            >
              Register
            </button>
          )}
          <button
            onClick={() => router.push(`/events/${eventId}/room`)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-muted"
          >
            Enter Room
          </button>
          {isFacilitator && (
            <button
              onClick={() => router.push(`/events/${eventId}/edit`)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-fg hover:bg-muted"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <Footer role={isFacilitator ? "facilitator" : "attendee"} />
    </div>
  );
}
