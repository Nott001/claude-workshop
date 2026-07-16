"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, Clock3, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatEventDate, formatTime, eventStatusLabel } from "@/lib/landing";

interface SpeakerProfile {
  speaker_profile_id: number;
  bio: string | null;
  photo_url: string | null;
  designation: string | null;
}

interface EventSpeaker {
  SPEAKER_PROFILES: SpeakerProfile;
}

interface Course {
  course_id: number;
  course_name: string;
  course_description: string | null;
}

interface Event {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  lat: number | null;
  lng: number | null;
  course_id: number | null;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
  price: number;
  currency: string;
  COURSE: Course | null;
  EVENT_SPEAKERS: EventSpeaker[];
  payment_count?: number;
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasTicket, setHasTicket] = useState(false);

  const DEBUG_BYPASS =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug_bypass_session") === "true";

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) {
        setError("Event not found");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEvent(data);
      setLoading(false);
    }
    load();
  }, [eventId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUserRole(data.role ?? null))
      .catch(() => {});
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/tickets")
      .then((r) => (r.ok ? r.json() : []))
      .then((tickets) => {
        const hasTicketForEvent = tickets.some(
          (t: { event_id: number; status: string }) => t.event_id === Number(eventId) && t.status !== "cancelled",
        );
        setHasTicket(hasTicketForEvent);
      })
      .catch(() => {});
  }, [eventId, isLoaded, isSignedIn]);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [sessionLive, setSessionLive] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!event) return;
    fetch(`/api/live/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((state) => {
        if (state && state.session_status === "live") setSessionLive(true);
      })
      .catch(() => {});
  }, [event, eventId]);

  async function handleRegister() {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/events/${eventId}`);
      return;
    }

    router.push(`/events/${eventId}/register`);
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const res = await fetch(`/api/events/${eventId}/publish`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      setPublishError(body.error ?? "Failed to publish event");
      setPublishing(false);
      return;
    }
    setEvent({ ...event!, status: "active" });
    setPublishing(false);
  }

  async function handleDelete() {
    setDeleteConfirmText("");
    setDeleteError(null);
    if (event && event.payment_count && event.payment_count > 0) {
      setShowDeleteModal(true);
    } else {
      if (confirm("Delete this event? This cannot be undone.")) {
        await confirmDelete();
      }
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setDeleteError(body.error ?? "Failed to delete event");
      setDeleting(false);
      return;
    }
    router.push("/events");
  }

  async function handleStartSession() {
    setStarting(true);
    await fetch(`/api/live/${eventId}/state`, { method: "POST" });
    setSessionLive(true);
    setStarting(false);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error ?? "Event not found"}</div>
      </div>
    );
  }

  const isFacilitator = userRole === "facilitator";
  const canManage = isFacilitator;

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative h-56 overflow-hidden bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300 lg:h-64">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="size-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <button
              onClick={() => router.push("/events")}
              className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
            >
              <span className="material-symbols-rounded text-sm">arrow_back</span>
              Back to events
            </button>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{event.title}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  event.status === "active" && "bg-green-900/20 text-green-600",
                  event.status === "draft" && "bg-surface text-muted-foreground",
                  event.status === "complete" && "bg-green-900/20 text-green-600",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {eventStatusLabel(event.status)}
              </span>
              {event.COURSE && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-900/20 px-3 py-1 text-xs font-semibold text-blue-600">
                  <span className="material-symbols-rounded text-sm">school</span>
                  {event.COURSE.course_name}
                </span>
              )}
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2.5">
                <CalendarDays className="size-4 text-blue-500" />
                {formatEventDate(event.event_date)}
              </p>
              <p className="flex items-center gap-2.5">
                <Clock3 className="size-4 text-blue-500" />
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </p>
              <p className="flex items-center gap-2.5">
                <MapPin className="size-4 text-blue-500" />
                {event.venue_name}
                {event.venue_address && <span className="text-muted-foreground/60"> · {event.venue_address}</span>}
              </p>
              {event.price > 0 && (
                <p className="flex items-center gap-2.5 text-foreground">
                  <span className="material-symbols-rounded text-sm text-blue-500">payments</span>
                  <span className="font-semibold">
                    {event.price.toLocaleString()} {event.currency}
                  </span>
                </p>
              )}
            </div>
          </div>

          {event.EVENT_SPEAKERS.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Speakers</h2>
              <div className="space-y-3">
                {event.EVENT_SPEAKERS.map((es) => {
                  const sp = es.SPEAKER_PROFILES;
                  return (
                    <div key={sp.speaker_profile_id} className="flex items-start gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                        {sp.photo_url ? (
                          <img src={sp.photo_url} alt="" className="size-full rounded-full object-cover" />
                        ) : (
                          "SP"
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{sp.designation || "Speaker"}</div>
                        {sp.bio && <p className="mt-0.5 text-xs text-muted-foreground">{sp.bio}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {event.COURSE && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Linked curriculum</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{event.COURSE.course_name}</p>
                  {event.COURSE.course_description && (
                    <p className="mt-2 text-xs text-muted-foreground">{event.COURSE.course_description}</p>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => router.push(`/events/${eventId}/edit`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <span className="material-symbols-rounded text-sm">edit</span>
                    Manage
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduling</h3>
            <p className="mt-2 text-sm font-medium text-foreground">{formatEventDate(event.event_date)}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Venue</h3>
            <p className="mt-2 text-sm font-medium text-foreground">{event.venue_name}</p>
            {event.venue_address && <p className="text-xs text-muted-foreground">{event.venue_address}</p>}
          </div>

          {event.status === "draft" && canManage && (
            <div className="space-y-2">
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <span className="material-symbols-rounded text-sm">publish</span>
                {publishing ? "Publishing..." : "Publish Event"}
              </button>
              {publishError && <p className="text-xs text-destructive">{publishError}</p>}
            </div>
          )}

          {event.status === "active" && !isFacilitator && userRole !== "speaker" && (
            <button
              onClick={handleRegister}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-rounded text-sm">how_to_reg</span>
              Register
            </button>
          )}

          {event.status === "active" && isFacilitator && !sessionLive && (
            <button
              onClick={handleStartSession}
              disabled={starting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-500 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
            >
              <span className="material-symbols-rounded text-sm">play_arrow</span>
              {starting ? "Starting..." : "Start event session"}
            </button>
          )}

          {event.status === "active" &&
            sessionLive &&
            (hasTicket || DEBUG_BYPASS || isFacilitator || userRole === "speaker") && (
              <button
                onClick={() => router.push(`/events/${eventId}/live`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
              >
                <span className="material-symbols-rounded text-sm">play_circle</span>
                Enter event session
              </button>
            )}

          {isSignedIn && canManage && (
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/events/${eventId}/edit`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
              >
                <span className="material-symbols-rounded text-sm">edit</span>
                Edit event
              </button>
              <button
                onClick={() => router.push(`/events/${eventId}/speakers`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
              >
                <span className="material-symbols-rounded text-sm">groups</span>
                Manage speakers
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                <span className="material-symbols-rounded text-sm">delete</span>
                Delete event
              </button>
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            </div>
          )}

          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <span className="material-symbols-rounded text-2xl text-red-500">warning</span>
                  <h3 className="text-sm font-semibold text-foreground">Delete event</h3>
                </div>
                <p className="mb-2 text-sm text-muted-foreground">
                  This event has existing payments. Deleting it will also remove all associated data, including payments,
                  tickets, and chat messages. This action <strong>cannot be undone</strong>.
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Type <strong>understood</strong> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='type "understood"'
                  className="mb-4 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-red-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleteConfirmText !== "understood" || deleting}
                    className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete event"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
