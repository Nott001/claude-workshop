"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge, type EventStatus } from "@/components/status-badge";
import { CountdownTimer } from "@/components/countdown-timer";
import { Footer } from "@/components/footer";
import { formatEventDate, formatTime, isEventLive } from "@/lib/landing";

interface EventData {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  course_name: string | null;
  description: string | null;
  attendee_count: number;
}

function eventStatusBadge(status: string, eventDate: string, startTime: string, endTime: string): EventStatus {
  if (isEventLive(eventDate, startTime, endTime)) return "live";
  switch (status) {
    case "active":
      return "upcoming";
    case "complete":
      return "completed";
    default:
      return status as EventStatus;
  }
}

function statusLabel(status: string, eventDate: string, startTime: string, endTime: string): string {
  if (isEventLive(eventDate, startTime, endTime)) return "Live Now";
  switch (status) {
    case "active":
      return "Upcoming Event";
    case "complete":
      return "Past Event";
    default:
      return status;
  }
}

export default function SpeakerEventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvent() {
      const res = await fetch(`/api/speakers/me/events/${eventId}`);
      const data = await res.json();
      if (!res.ok) {
        if (!cancelled) setError(data.error ?? "Failed to load event details");
        setLoading(false);
        return;
      }
      if (!cancelled) {
        setEvent(data);
        setLoading(false);
      }
    }

    fetchEvent();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-sm text-muted-fg">Loading event details...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
        <div className="text-sm text-error">{error ?? "Event not found"}</div>
        <button
          onClick={() => router.push("/speakers/dashboard")}
          className="mt-4 text-sm font-semibold text-brand hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isLive = isEventLive(event.event_date, event.start_time, event.end_time);
  const isUpcoming = !isLive && event.status === "active";
  const isComplete = event.status === "complete";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <button
          onClick={() => router.push("/speakers/dashboard")}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-fg transition-colors hover:text-fg"
        >
          <span className="material-symbols-rounded text-base">arrow_back</span>
          Back to Dashboard
        </button>

        <div className="grid grid-cols-12 gap-6">
          {/* Hero Card */}
          <div className="col-span-8 overflow-hidden rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
            <div className="relative h-[400px] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,0.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.6)] to-[rgba(0,0,0,0)]" />

              <div className="absolute bottom-8 left-8 flex flex-col gap-3">
                <StatusBadge
                  status={eventStatusBadge(event.status, event.event_date, event.start_time, event.end_time)}
                  label={statusLabel(event.status, event.event_date, event.start_time, event.end_time)}
                  className="w-fit bg-brand text-brand border-0"
                />
                <h1 className="text-[48px] font-bold leading-[56px] tracking-[-0.96px] text-white">{event.title}</h1>
                <div className="flex items-center gap-6 pt-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <span className="material-symbols-rounded text-base">calendar_today</span>
                    {formatEventDate(event.event_date)}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <span className="material-symbols-rounded text-base">schedule</span>
                    {formatTime(event.start_time)} – {formatTime(event.end_time)}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <span className="material-symbols-rounded text-base">location_on</span>
                    {event.venue_name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="col-span-4 flex flex-col gap-6">
            <div className="flex flex-col justify-center rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <span className="text-sm font-medium tracking-[0.7px] text-muted-fg">Total Registered Attendees</span>
              <span className="mt-2 text-[48px] font-bold leading-[56px] tracking-[-0.96px] text-brand">
                {event.attendee_count.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col justify-center rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] px-8 py-12 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <span className="text-sm font-medium tracking-[0.7px] text-muted-fg">Status</span>
              <div className="mt-2 flex items-center gap-4">
                {isLive && <span className="size-3 animate-pulse rounded-full bg-brand" />}
                {isUpcoming && <span className="size-3 rounded-full bg-brand" />}
                {isComplete && <span className="size-3 rounded-full bg-muted-fg" />}
                <span className="text-[24px] font-semibold leading-[32px] text-fg">
                  {statusLabel(event.status, event.event_date, event.start_time, event.end_time)}
                </span>
              </div>
              {isUpcoming && (
                <div className="mt-4">
                  <CountdownTimer eventDate={event.event_date} startTime={event.start_time} />
                </div>
              )}
              {!isUpcoming && <span className="mt-2 text-base text-muted-fg">{event.venue_name}</span>}
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="col-span-7">
            <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <h2 className="text-[24px] font-semibold text-fg">Full Event Description</h2>
              <div className="mt-6 flex flex-col gap-4">
                {event.description ? (
                  event.description.split("\n").map((para, i) => (
                    <p key={i} className="text-base leading-[26px] text-muted-fg">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="text-base leading-[26px] text-muted-fg">No description available for this event.</p>
                )}
              </div>
            </div>
          </div>

          {/* Speaker Actions */}
          <div className="col-span-5">
            <div className="rounded-xl border border-[rgba(0,102,136,0.2)] bg-[rgba(0,102,136,0.05)] p-8">
              <h2 className="text-[24px] font-semibold text-fg">Speaker Actions</h2>

              <div className="mt-6">
                <Link
                  href={`/events/${eventId}/room`}
                  className="flex w-full items-center justify-center gap-3 rounded-lg bg-brand py-4 text-[16px] font-bold text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] transition-colors hover:bg-brand/90"
                >
                  <span className="material-symbols-rounded text-[19px]">play_arrow</span>
                  Enter Event Room
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer role="speaker" />
    </div>
  );
}
