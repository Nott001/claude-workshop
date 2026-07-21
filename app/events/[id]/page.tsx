"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";

import { formatTime, formatEventDate } from "@/lib/landing";
import { CountdownTimer } from "@/components/countdown-timer";
import { FloatingAssistButton } from "@/components/floating-assist-button";
import { StatusBadge, type EventStatus } from "@/components/status-badge";
import { Footer } from "@/components/footer";

interface SpeakerProfile {
  speaker_profile_id: number;
  bio: string | null;
  photo_url: string | null;
  designation: string | null;
  USERS?: { full_name: string; email: string } | null;
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
  course_id: number | null;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
  price: number;
  currency: string;
  description: string | null;
  COURSE: Course | null;
  EVENT_SPEAKERS: EventSpeaker[];
  attendee_count?: number;
  payment_count?: number;
}

function formatHeroDateTime(dateStr: string, startTime: string, endTime: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${formatTime(startTime)} - ${formatTime(endTime)}, ${month} ${day} ${year}`;
}

interface AttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
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
  const [recentAttendees, setRecentAttendees] = useState<AttendeeRow[]>([]);
  const [attendeesTotal, setAttendeesTotal] = useState(0);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

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

  const [speakerProfileId, setSpeakerProfileId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || userRole !== "speaker") return;
    fetch("/api/speakers/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.speaker_profile_id) setSpeakerProfileId(data.speaker_profile_id);
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, userRole]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || userRole !== "facilitator") return;
    setAttendeesLoading(true);
    fetch(`/api/events/${eventId}/attendees?limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRecentAttendees(data.attendees);
          setAttendeesTotal(data.total);
        }
        setAttendeesLoading(false);
      })
      .catch(() => setAttendeesLoading(false));
  }, [eventId, isLoaded, isSignedIn, userRole]);

  const isSpeakerAssigned =
    speakerProfileId &&
    event?.EVENT_SPEAKERS?.some(
      (es: { SPEAKER_PROFILES: { speaker_profile_id: number } }) => es.SPEAKER_PROFILES.speaker_profile_id === speakerProfileId,
    );

  const eventStarted = event ? new Date(`${event.event_date}T${event.start_time}`) <= new Date() : true;

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
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

  if (isFacilitator) {
    const badgeStatus: EventStatus =
      event.status === "active" ? "upcoming" : event.status === "complete" ? "completed" : "draft";
    const badgeLabel = event.status === "draft" ? "Draft" : event.status === "active" ? "Upcoming" : "Completed";

    return (
      <div className="flex min-h-screen flex-col bg-[#fbf9f8]">
        <div className="flex flex-1 flex-col px-16 pt-24 pb-12">
          <button
            onClick={() => router.push("/events")}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#5f5e5e] transition-colors hover:text-[#1b1c1c]"
          >
            <ArrowLeft className="size-4" />
            Back to Events
          </button>

          <div className="grid grid-cols-12 gap-6">
            {/* Main content */}
            <div className="col-span-8 flex flex-col gap-6">
              {/* Hero with cover image */}
              <div className="relative overflow-hidden rounded-xl border border-[rgba(229,231,235,0.5)] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                <div className="relative h-[320px]">
                  {event.cover_image_url ? (
                    <img src={event.cover_image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300">
                      <span className="material-symbols-rounded text-6xl text-white/50">image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.7)] to-[rgba(0,0,0,0)]" />
                  <div className="absolute bottom-8 left-8 right-8 flex flex-col gap-3">
                    <StatusBadge
                      status={badgeStatus}
                      label={badgeLabel}
                      className="w-fit bg-[#3db9ee] text-[#00465f] border-0"
                    />
                    <h1 className="text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-white">{event.title}</h1>
                    <div className="flex flex-wrap gap-6 text-sm font-medium text-white/90">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-rounded text-[16px]">calendar_today</span>
                        {formatEventDate(event.event_date)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-rounded text-[16px]">schedule</span>
                        {formatTime(event.start_time)} – {formatTime(event.end_time)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-rounded text-[16px]">location_on</span>
                        {event.venue_name}
                      </span>
                    </div>
                    {event.status === "active" && (
                      <div className="mt-1">
                        <CountdownTimer eventDate={event.event_date} startTime={event.start_time} light />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Curriculum */}
              {event.COURSE && (
                <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                      <span className="material-symbols-rounded text-lg text-[#3db9ee]">school</span>
                    </div>
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1b1c1c]">Linked Curriculum</h2>
                    </div>
                  </div>
                  <h3 className="mb-2 text-[24px] font-bold text-[#1b1c1c]">{event.COURSE.course_name}</h3>
                  {event.COURSE.course_description && (
                    <p className="mb-4 text-base leading-[26px] text-[#3E484F]">{event.COURSE.course_description}</p>
                  )}
                  <button
                    onClick={() => router.push(`/courses/${event.COURSE!.course_id}`)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#3db9ee] bg-[#e8f8fe] px-4 py-2.5 text-sm font-semibold text-[#1789b8] transition-colors hover:bg-[#d0f1fd]"
                  >
                    <span className="material-symbols-rounded text-sm">open_in_new</span>
                    View Curriculum
                  </button>
                </div>
              )}

              {/* Speaker */}
              {event.EVENT_SPEAKERS.length > 0 ? (
                (() => {
                  const sp = event.EVENT_SPEAKERS[0].SPEAKER_PROFILES;
                  const name = sp.USERS?.full_name || "Speaker";
                  const email = sp.USERS?.email || null;
                  const initials = name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2);
                  return (
                    <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
                      <div className="flex items-center gap-5">
                        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#C2E8FF] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                          {sp.photo_url ? (
                            <img src={sp.photo_url} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-[#3db9ee]">{initials || "SP"}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold text-[#1b1c1c]">{name}</p>
                          {sp.designation && (
                            <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#6E7980]">{sp.designation}</p>
                          )}
                          {email && <p className="mt-1 text-sm text-[#5f5e5e]">{email}</p>}
                          {sp.bio && <p className="mt-2 text-sm leading-[22px] text-[#3E484F]">{sp.bio}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-xl border border-dashed border-[#d0d5dd] bg-[rgba(255,255,255,0.9)] px-8 py-6 text-center text-sm text-[#5f5e5e] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                  No speaker assigned yet
                </div>
              )}

              {/* Recent Registrations */}
              <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-[20px] font-semibold text-[#1b1c1c]">Recent Registrations</h2>
                  <button
                    onClick={() => router.push(`/kiosk/${eventId}/attendees`)}
                    className="text-sm font-medium text-[#3db9ee] hover:underline"
                  >
                    View all ({attendeesTotal})
                  </button>
                </div>
                {attendeesLoading ? (
                  <div className="py-8 text-center text-sm text-[#5f5e5e]">Loading...</div>
                ) : recentAttendees.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[#5f5e5e]">No registrations yet</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(229,231,235,0.5)] text-[#6E7980]">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Email</th>
                        <th className="pb-3 pr-4 font-medium">Status</th>
                        <th className="pb-3 font-medium">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttendees.map((a) => (
                        <tr key={a.user_id} className="border-b border-[rgba(229,231,235,0.2)]">
                          <td className="py-3 pr-4 text-[#1b1c1c]">{a.full_name}</td>
                          <td className="py-3 pr-4 text-[#5f5e5e]">{a.email}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                a.ticket_status === "checked_in"
                                  ? "bg-green-50 text-green-700"
                                  : a.ticket_status === "issued"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-gray-50 text-gray-500"
                              }`}
                            >
                              {a.ticket_status === "checked_in"
                                ? "Checked in"
                                : a.ticket_status === "issued"
                                  ? "Registered"
                                  : "Cancelled"}
                            </span>
                          </td>
                          <td className="py-3 text-[#5f5e5e]">{new Date(a.issued_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-4 flex flex-col gap-6">
              {/* Analytics */}
              <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
                <span className="text-sm font-medium text-[#3e484f]">Tickets Issued</span>
                <p className="mt-2 text-[48px] font-bold leading-[56px] tracking-[-0.02em] text-[#3db9ee]">
                  {event.attendee_count?.toLocaleString() ?? "0"}
                </p>
              </div>

              {/* Actions */}
              <div className="rounded-xl border border-[rgba(229,231,235,0.5)] bg-[rgba(255,255,255,0.9)] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-[5px]">
                <h2 className="mb-4 text-[16px] font-semibold text-[#1b1c1c]">Actions</h2>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => router.push(`/events/${eventId}/room`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3db9ee] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2da3d9]"
                  >
                    <span className="material-symbols-rounded text-sm">play_circle</span>
                    Enter Event Room
                  </button>
                  <button
                    onClick={() => router.push(`/events/${eventId}/edit`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#bdc8d0] py-3 text-sm font-semibold text-[#1b1c1c] transition-colors hover:bg-gray-50"
                  >
                    <span className="material-symbols-rounded text-sm">edit</span>
                    Edit Event
                  </button>
                  <button
                    onClick={() => router.push(`/kiosk/${eventId}/attendees`)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#bdc8d0] py-3 text-sm font-semibold text-[#1b1c1c] transition-colors hover:bg-gray-50"
                  >
                    <span className="material-symbols-rounded text-sm">qr_code_scanner</span>
                    View All Attendees
                  </button>
                  {event.status === "draft" && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                      <span className="material-symbols-rounded text-sm">publish</span>
                      {publishing ? "Publishing..." : "Publish Event"}
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                  >
                    <span className="material-symbols-rounded text-sm">delete</span>
                    Delete Event
                  </button>
                </div>
                {publishError && <p className="mt-2 text-xs text-red-500">{publishError}</p>}
                {deleteError && <p className="mt-2 text-xs text-red-500">{deleteError}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl border border-[#bdc8d0] bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-3">
                <span className="material-symbols-rounded text-2xl text-red-500">warning</span>
                <h3 className="text-sm font-semibold text-[#1B1C1C]">Delete event</h3>
              </div>
              <p className="mb-2 text-sm text-[#3E484F]">
                This event has existing payments. Deleting it will also remove all associated data, including payments, tickets,
                and chat messages. This action <strong>cannot be undone</strong>.
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

        <Footer role="facilitator" />
      </div>
    );
  }

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

                {/* Speaker */}
                {event.EVENT_SPEAKERS.length > 0 &&
                  (() => {
                    const sp = event.EVENT_SPEAKERS[0].SPEAKER_PROFILES;
                    const name = sp.USERS?.full_name || "Speaker";
                    const email = sp.USERS?.email || null;
                    const initials = name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2);
                    return (
                      <div className="mt-8">
                        <h2 className="mb-8 text-[24px] font-semibold text-[#1B1C1C]">Speaker</h2>
                        <div className="flex items-center gap-8 rounded-xl border border-[rgba(189,200,208,0.2)] bg-[#f5f3f3] p-8">
                          <div className="grid size-[100px] shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#C2E8FF] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            {sp.photo_url ? (
                              <img src={sp.photo_url} alt="" className="size-full object-cover" />
                            ) : (
                              <span className="text-2xl font-bold text-[#3db9ee]">{initials}</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-3">
                            <div>
                              <h3 className="text-[24px] font-semibold text-[#1B1C1C]">{name}</h3>
                              <p className="text-sm font-medium uppercase tracking-[0.05em] text-[#6E7980]">
                                {sp.designation || "Speaker"}
                              </p>
                            </div>
                            {email && <p className="text-base text-[#3E484F]">{email}</p>}
                            {sp.bio && <p className="text-base text-[#3E484F]">{sp.bio}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {/* Linked Curriculum */}
                {event.COURSE && (
                  <div className="mt-8 rounded-xl border border-[rgba(189,200,208,0.2)] bg-[#f5f3f3] p-8">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
                        <span className="material-symbols-rounded text-lg text-[#3db9ee]">school</span>
                      </div>
                      <div>
                        <h2 className="text-[20px] font-semibold text-[#1B1C1C]">Linked Curriculum</h2>
                      </div>
                    </div>
                    <h3 className="mb-2 text-[24px] font-bold text-[#1B1C1C]">{event.COURSE.course_name}</h3>
                    {event.COURSE.course_description && (
                      <p className="mb-4 text-base leading-[26px] text-[#3E484F]">{event.COURSE.course_description}</p>
                    )}
                    {userRole === "facilitator" && (
                      <button
                        onClick={() => router.push(`/courses/${event.COURSE!.course_id}`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#3db9ee] bg-[#e8f8fe] px-4 py-2.5 text-sm font-semibold text-[#1789b8] transition-colors hover:bg-[#d0f1fd]"
                      >
                        <span className="material-symbols-rounded text-sm">open_in_new</span>
                        View Curriculum
                      </button>
                    )}
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
                    {event.price > 0 && !hasTicket && (
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
                        <>
                          {hasTicket ? (
                            <div className="flex flex-col gap-2">
                              {!eventStarted && (
                                <p className="text-xs text-[#6E7980] leading-relaxed">
                                  The event hasn&apos;t started yet. Feel free to explore the available resources ahead of time.
                                </p>
                              )}
                              <button
                                onClick={() => router.push(`/events/${eventId}/room`)}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#29B6F6] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#039be5]"
                              >
                                Enter event room
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={handleRegister}
                              className="flex w-full items-center justify-center rounded-lg bg-[#29B6F6] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#039be5]"
                            >
                              Register
                            </button>
                          )}
                        </>
                      )}

                      {userRole === "speaker" && isSpeakerAssigned && (
                        <button
                          onClick={() => router.push(`/events/${eventId}/room`)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#29B6F6] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#039be5]"
                        >
                          Enter event room
                        </button>
                      )}
                    </div>
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
                  <button
                    onClick={() => router.push(`/events/${eventId}/room`)}
                    className="inline-flex items-center gap-2 rounded-lg border border-green-500 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
                  >
                    <span className="material-symbols-rounded text-sm">play_circle</span>
                    Enter event room
                  </button>
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

            <Footer role="attendee" />
          </div>
        </div>
      </div>

      {/* Floating Assist Button */}
      <FloatingAssistButton />
    </div>
  );
}
