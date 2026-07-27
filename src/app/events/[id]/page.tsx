"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "@/modules/auth";
import { Footer } from "@/components/footer";
import { FacilitatorEventDetail } from "@/modules/event-management/ui/event-detail-facilitator";
import { AttendeeEventDetail } from "@/modules/event-management/ui/event-detail-attendee";
import { getBadgeProps } from "@/modules/event-management";

interface SpeakerProfile {
  id: number;
  bio: string | null;
  designation: string | null;
  USERS?: { full_name: string; email: string } | null;
}

interface EventSpeaker {
  SPEAKER_PROFILES: SpeakerProfile;
}

interface Course {
  id: number;
  course_name: string;
  course_description: string | null;
}

interface Event {
  id: number;
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
  const { loading: isLoaded, isSignedIn } = useSession();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [recentAttendees, setRecentAttendees] = useState<AttendeeRow[]>([]);
  const [attendeesTotal, setAttendeesTotal] = useState(0);
  const [attendeesLoading, setAttendeesLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        if (data?.id) setSpeakerProfileId(data.id);
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, userRole]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || userRole !== "facilitator") return;
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
    event?.EVENT_SPEAKERS?.some((es: { SPEAKER_PROFILES: { id: number } }) => es.SPEAKER_PROFILES.id === speakerProfileId);

  const eventStarted = event ? new Date(`${event.event_date}T${event.start_time}`) <= new Date() : true;
  const badgeProps = event ? getBadgeProps(event) : null;

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
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setDeleteError(body.error ?? "Failed to delete event");
      return;
    }
    router.push("/events");
  }

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

  const isFacilitator = userRole === "facilitator";
  const canManage = isFacilitator;
  const showCountdown = event.status === "active";

  return (
    <div className="flex flex-1 flex-col bg-bg">
      {isFacilitator ? (
        <FacilitatorEventDetail
          event={event}
          recentAttendees={recentAttendees}
          attendeesTotal={attendeesTotal}
          attendeesLoading={attendeesLoading}
          badgeProps={badgeProps!}
          publishing={publishing}
          publishError={publishError}
          deleteError={deleteError}
          onPublish={handlePublish}
          onDelete={handleDelete}
          onEdit={() => router.push(`/events/${eventId}/edit`)}
          onEnterRoom={() => router.push(`/events/${eventId}/room`)}
        />
      ) : (
        <AttendeeEventDetail
          event={event}
          badgeProps={badgeProps!}
          hasTicket={hasTicket}
          userRole={userRole}
          isSpeakerAssigned={isSpeakerAssigned}
          eventStarted={eventStarted}
          showCountdown={showCountdown}
          isSignedIn={!!isSignedIn}
          canManage={canManage}
          publishing={publishing}
          publishError={publishError}
          deleteError={deleteError}
          onRegister={handleRegister}
          onPublish={handlePublish}
          onDelete={handleDelete}
          onEnterRoom={() => router.push(`/events/${eventId}/room`)}
          onEdit={() => router.push(`/events/${eventId}/edit`)}
          onManageSpeakers={() => router.push(`/events/${eventId}/speakers`)}
        />
      )}
      <Footer role={isFacilitator ? "facilitator" : "attendee"} />
    </div>
  );
}
