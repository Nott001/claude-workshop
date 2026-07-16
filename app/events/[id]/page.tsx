"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { formatTime } from "@/lib/landing";
import { CountdownTimer } from "@/components/countdown-timer";
import { FloatingAssistButton } from "@/components/floating-assist-button";
import { MarketingFooter } from "@/components/marketing-footer";

interface SpeakerProfile {
  speaker_profile_id: number;
  bio: string | null;
  photo_url: string | null;
  designation: string | null;
  full_name?: string;
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
  description: string | null;
  overview: string | null;
  COURSE: Course | null;
  EVENT_SPEAKERS: EventSpeaker[];
  payment_count?: number;
}

function formatHeroDateTime(dateStr: string, startTime: string, endTime: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${formatTime(startTime)} - ${formatTime(endTime)}, ${month} ${day} ${year}`;
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
        <div className="text-sm text-[#6E7980]">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-red-500">{error ?? "Event not found"}</div>
      </div>
    );
  }

  const isFacilitator = userRole === "facilitator";
  const canManage = isFacilitator;
  const showCountdown = event.status === "active";

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="mx-auto w-full max-w-[1238px] px-0 py-[70px]">
        <div className="flex flex-col gap-[10px] px-0">
          <div className="flex flex-col gap-12 px-[48px]">
            {/* Hero Section */}
            <div className="overflow-hidden rounded-2xl border border-[rgba(189,200,208,0.3)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="flex">
                {/* Left: Cover image */}
                <div className="relative w-[567px] shrink-0">
                  {event.cover_image_url ? (
                    <img src={event.cover_image_url} alt={event.title} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300">
                      <span className="material-symbols-rounded text-6xl text-white/50">image</span>
                    </div>
                  )}
                  {event.COURSE && (
                    <div className="absolute inset-x-0 bottom-0 bg-white px-[20px] pb-4 pt-0 rounded-tr-[50px]">
                      <div className="pt-4">
                        <h2 className="text-[32px] font-bold leading-[60px] tracking-[-0.03em] text-[#1B1C1C]">
                          {event.COURSE.course_name}
                        </h2>
                        <p className="text-base text-[#1B1C1C]">{event.COURSE.course_description || "Course Description"}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Event info */}
                <div className="flex flex-1 flex-col justify-center gap-8 p-12">
                  <div>
                    <p className="text-lg font-bold text-[#3db9ee]">
                      {formatHeroDateTime(event.event_date, event.start_time, event.end_time)}
                    </p>
                  </div>

                  <div>
                    <h1 className="text-[48px] font-bold leading-[56px] tracking-[-0.02em] text-[#1B1C1C]">{event.title}</h1>
                  </div>

                  <div className="flex flex-col gap-8">
                    {event.status === "active" && !isFacilitator && userRole !== "speaker" && (
                      <button
                        onClick={handleRegister}
                        className="inline-flex w-fit items-center justify-center rounded-lg bg-[#3db9ee] px-10 py-4 text-base font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#239dce]"
                      >
                        Register
                      </button>
                    )}

                    {showCountdown && <CountdownTimer eventDate={event.event_date} startTime={event.start_time} />}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Layout: 3-column grid */}
            <div className="grid grid-cols-3 gap-12">
              {/* Article: 2 columns */}
              <div className="col-span-2 flex flex-col gap-6">
                {/* Description */}
                {event.description && (
                  <div>
                    <p className="text-lg leading-[29.25px] text-[#3E484F]">{event.description}</p>
                  </div>
                )}

                {/* Overview */}
                {event.overview && (
                  <div>
                    <p className="text-lg leading-[29.25px] text-[#3E484F]">{event.overview}</p>
                  </div>
                )}

                {/* Speakers */}
                {event.EVENT_SPEAKERS.length > 0 && (
                  <div className="mt-8">
                    <h2 className="mb-8 text-[24px] font-semibold text-[#1B1C1C]">Speakers</h2>
                    <div className="flex flex-col gap-8">
                      {event.EVENT_SPEAKERS.map((es) => {
                        const sp = es.SPEAKER_PROFILES;
                        return (
                          <div
                            key={sp.speaker_profile_id}
                            className="flex items-center gap-8 rounded-xl border border-[rgba(189,200,208,0.2)] bg-[#f5f3f3] p-8"
                          >
                            <div className="grid size-[100px] shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#C2E8FF] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                              {sp.photo_url ? (
                                <img src={sp.photo_url} alt="" className="size-full object-cover" />
                              ) : (
                                <span className="text-2xl font-bold text-[#3db9ee]">
                                  {sp.full_name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2) || "SP"}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-4">
                              <div>
                                <h3 className="text-[24px] font-semibold text-[#1B1C1C]">{sp.full_name || "Speaker"}</h3>
                                <p className="text-sm font-medium uppercase tracking-[0.05em] text-[#6E7980]">
                                  {sp.designation || "Speaker"}
                                </p>
                              </div>
                              {sp.bio && <p className="text-base text-[#3E484F]">{sp.bio}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar: 1 column */}
              <div className="col-span-1">
                <div className="sticky top-[70px] flex flex-col gap-6">
                  {/* Registration info card */}
                  <div className="flex flex-col gap-6 rounded-2xl border border-[#BDC8D1] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    {/* Venue Location */}
                    <div className="flex items-center gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                        <span className="material-symbols-rounded text-lg text-[#3db9ee]">location_on</span>
                      </div>
                      <div>
                        <p className="text-base text-[#191C1E]">Venue Location</p>
                        <p className="text-base text-[#3E4850]">
                          {event.venue_name}
                          {event.venue_address && <>, {event.venue_address}</>}
                        </p>
                      </div>
                    </div>

                    {/* Event Price */}
                    {event.price > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                          <span className="material-symbols-rounded text-lg text-[#3db9ee]">payments</span>
                        </div>
                        <div>
                          <p className="text-base text-[#191C1E]">Event Price</p>
                          <p className="text-[24px] font-semibold text-[#3db9ee]">
                            {event.currency} {event.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex flex-col gap-3">
                      {event.status === "active" && !isFacilitator && userRole !== "speaker" && (
                        <button
                          onClick={handleRegister}
                          className="flex w-full items-center justify-center rounded-lg bg-[#29B6F6] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#039be5]"
                        >
                          Register
                        </button>
                      )}

                      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#6E7881] px-4 py-3 text-base font-bold text-[#191C1E] transition-colors hover:bg-gray-50">
                        <span className="material-symbols-rounded text-[15px]">calendar_today</span>
                        Add to calendar
                      </button>
                    </div>

                    {/* Share */}
                    <div className="border-t border-[#BDC8D1] pt-6">
                      <div className="flex items-center justify-between">
                        <span className="text-base text-[#5F5E5E]">Share</span>
                        <div className="flex gap-4">
                          <button
                            className="text-[#5F5E5E] transition-colors hover:text-[#3db9ee]"
                            aria-label="Share on Facebook"
                          >
                            <svg className="size-[18px]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                            </svg>
                          </button>
                          <button
                            className="text-[#5F5E5E] transition-colors hover:text-[#3db9ee]"
                            aria-label="Share on Twitter"
                          >
                            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </button>
                          <button
                            className="text-[#5F5E5E] transition-colors hover:text-[#3db9ee]"
                            aria-label="Share on LinkedIn"
                          >
                            <svg className="size-[20px]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Map preview */}
                  <div className="relative h-[192px] overflow-hidden rounded-2xl border border-[#BDC8D1] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                    <img src="/images/event-map-preview-3f01c8.png" alt="Map preview" className="size-full object-cover" />
                    <div className="absolute inset-0 bg-black/10" />
                    <button className="absolute bottom-[14px] left-[17px] flex items-center rounded-lg bg-white/90 px-2 py-2 text-xs font-medium text-[#191C1E] shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] backdrop-blur-[6px] transition-colors hover:bg-white">
                      View in Maps
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Facilitator controls */}
            {isSignedIn && canManage && (
              <div className="flex flex-col gap-3 rounded-xl border border-[#bdc8d0] bg-[#f9fafb] p-6">
                <h3 className="mb-2 text-sm font-semibold text-[#1B1C1C]">Event Management</h3>
                <div className="flex flex-wrap gap-3">
                  {event.status === "draft" && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#3db9ee] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#239dce] disabled:opacity-50"
                    >
                      <span className="material-symbols-rounded text-sm">publish</span>
                      {publishing ? "Publishing..." : "Publish Event"}
                    </button>
                  )}
                  {event.status === "active" && !sessionLive && (
                    <button
                      onClick={handleStartSession}
                      disabled={starting}
                      className="inline-flex items-center gap-2 rounded-lg border border-green-500 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                    >
                      <span className="material-symbols-rounded text-sm">play_arrow</span>
                      {starting ? "Starting..." : "Start event session"}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/events/${eventId}/edit`)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#bdc8d0] bg-white px-4 py-2.5 text-sm font-semibold text-[#1B1C1C] transition-colors hover:bg-gray-50"
                  >
                    <span className="material-symbols-rounded text-sm">edit</span>
                    Edit event
                  </button>
                  <button
                    onClick={() => router.push(`/events/${eventId}/speakers`)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#bdc8d0] bg-white px-4 py-2.5 text-sm font-semibold text-[#1B1C1C] transition-colors hover:bg-gray-50"
                  >
                    <span className="material-symbols-rounded text-sm">groups</span>
                    Manage speakers
                  </button>
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                  >
                    <span className="material-symbols-rounded text-sm">delete</span>
                    Delete event
                  </button>
                </div>
                {publishError && <p className="text-xs text-red-500">{publishError}</p>}
                {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              </div>
            )}

            {/* Enter session button */}
            {event.status === "active" &&
              sessionLive &&
              (hasTicket || DEBUG_BYPASS || isFacilitator || userRole === "speaker") && (
                <button
                  onClick={() => router.push(`/events/${eventId}/live`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#3db9ee] bg-[#e8f8fe] px-4 py-2.5 text-sm font-semibold text-[#1789b8] transition-colors hover:bg-[#d0f1fd]"
                >
                  <span className="material-symbols-rounded text-sm">play_circle</span>
                  Enter event session
                </button>
              )}

            {/* Delete confirmation modal */}
            {showDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="mx-4 w-full max-w-md rounded-xl border border-[#bdc8d0] bg-white p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="material-symbols-rounded text-2xl text-red-500">warning</span>
                    <h3 className="text-sm font-semibold text-[#1B1C1C]">Delete event</h3>
                  </div>
                  <p className="mb-2 text-sm text-[#3E484F]">
                    This event has existing payments. Deleting it will also remove all associated data, including payments,
                    tickets, and chat messages. This action <strong>cannot be undone</strong>.
                  </p>
                  <p className="mb-4 text-sm text-[#3E484F]">
                    Type <strong>understood</strong> to confirm.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='type "understood"'
                    className="mb-4 w-full rounded-lg border border-[#bdc8d0] bg-white px-3 py-2 text-sm text-[#1B1C1C] outline-none focus:border-red-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="rounded-lg border border-[#bdc8d0] bg-white px-4 py-2 text-xs font-medium text-[#1B1C1C] transition-colors hover:bg-gray-50"
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

            {/* Marketing Footer */}
            <MarketingFooter />
          </div>
        </div>
      </div>

      {/* Floating Assist Button */}
      <FloatingAssistButton />
    </div>
  );
}
