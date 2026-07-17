"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, MapPin, Users, Lock, ArrowLeft } from "lucide-react";
import { StatusBadge, type EventStatus } from "@/components/status-badge";
import { CountdownTimer } from "@/components/countdown-timer";
import { Footer } from "@/components/footer";
import { formatEventDate, formatTime } from "@/lib/landing";

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

function eventStatusBadge(status: string): EventStatus {
  switch (status) {
    case "active":
      return "upcoming";
    case "live":
      return "live";
    case "complete":
      return "completed";
    default:
      return status as EventStatus;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Upcoming Event";
    case "live":
      return "Live Now";
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
    return () => { cancelled = true; };
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf9f8]">
        <div className="text-sm text-[#5f5e5e]">Loading event details...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbf9f8]">
        <div className="text-sm text-red-500">{error ?? "Event not found"}</div>
        <button
          onClick={() => router.push("/speakers/dashboard")}
          className="mt-4 text-sm font-semibold text-[#168cb9] hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isLive = event.status === "live";
  const isUpcoming = event.status === "active";
  const isComplete = event.status === "complete";

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf9f8]">
      <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
        <button
          onClick={() => router.push("/speakers/dashboard")}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#5f5e5e] transition-colors hover:text-[#1b1c1c]"
        >
          <ArrowLeft className="size-4" />
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
                  status={eventStatusBadge(event.status)}
                  label={statusLabel(event.status)}
                  className="w-fit bg-[#3db9ee] text-[#00465f] border-0"
                />
                <h1 className="text-[48px] font-bold leading-[56px] tracking-[-0.96px] text-white">
                  {event.title}
                </h1>
                <div className="flex items-center gap-6 pt-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <CalendarDays className="size-4" />
                    {formatEventDate(event.event_date)}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <Clock3 className="size-4" />
                    {formatTime(event.start_time)} – {formatTime(event.end_time)}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <MapPin className="size-4" />
                    {event.venue_name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="col-span-4 flex flex-col gap-6">
            <div className="flex flex-col justify-center rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <span className="text-sm font-medium tracking-[0.7px] text-[#3e484f]">
                Total Registered Attendees
              </span>
              <span className="mt-2 text-[48px] font-bold leading-[56px] tracking-[-0.96px] text-[#3db9ee]">
                {event.attendee_count.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col justify-center rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] px-8 py-12 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <span className="text-sm font-medium tracking-[0.7px] text-[#3e484f]">
                Status
              </span>
              <div className="mt-2 flex items-center gap-4">
                {isLive && (
                  <span className="size-3 animate-pulse rounded-full bg-[#3db9ee]" />
                )}
                {isUpcoming && (
                  <span className="size-3 rounded-full bg-[#3db9ee]" />
                )}
                {isComplete && (
                  <span className="size-3 rounded-full bg-[#5f5e5e]" />
                )}
                <span className="text-[24px] font-semibold leading-[32px] text-[#1b1c1c]">
                  {statusLabel(event.status)}
                </span>
              </div>
              {isUpcoming && (
                <div className="mt-4">
                  <CountdownTimer eventDate={event.event_date} startTime={event.start_time} />
                </div>
              )}
              {!isUpcoming && (
                <span className="mt-2 text-base text-[#3e484f]">
                  {event.venue_name}
                </span>
              )}
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="col-span-7">
            <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
              <h2 className="text-[24px] font-semibold text-[#1b1c1c]">Full Event Description</h2>
              <div className="mt-6 flex flex-col gap-4">
                {event.description ? (
                  event.description.split("\n").map((para, i) => (
                    <p key={i} className="text-base leading-[26px] text-[#3e484f]">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="text-base leading-[26px] text-[#5f5e5e]">
                    No description available for this event.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Speaker Actions */}
          <div className="col-span-5">
            <div className="rounded-xl border border-[rgba(0,102,136,0.2)] bg-[rgba(0,102,136,0.05)] p-8">
              <h2 className="text-[24px] font-semibold text-[#1b1c1c]">Speaker Actions</h2>

              <div className="mt-6">
                {isLive ? (
                  <Link
                    href={`/speakers/dashboard/live/${eventId}`}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#3db9ee] py-4 text-[16px] font-bold text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#2da3d9]"
                  >
                    <span className="material-symbols-rounded text-[19px]">play_arrow</span>
                    Enter Event Session
                  </Link>
                ) : (
                  <div className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-[#bdc8d0] bg-[#f5f3f3] py-4 text-[16px] font-bold text-[#9ca3af]">
                    <Lock className="size-5" />
                    {isComplete ? "Session Ended" : "Session Locked"}
                  </div>
                )}

                {isUpcoming && (
                  <p className="mt-4 text-center text-sm text-[#5f5e5e]">
                    The session will be available when the event goes live.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer role="speaker" />
    </div>
  );
}
