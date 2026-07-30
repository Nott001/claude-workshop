"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import { getBadgeProps } from "@/modules/events/lib/schemas";
import { fetchEventAccess } from "@/modules/events/lib/fetch-event-access";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { EventWithCourse } from "@/modules/events/lib/types";

export interface AttendeeRow {
  user_id: number;
  full_name: string;
  email: string;
  ticket_status: "issued" | "checked_in" | "cancelled";
  issued_at: string;
  checked_in_at: string | null;
}

export function useEventDetail(eventId: string) {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [event, setEvent] = useState<EventWithCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [recentAttendees, setRecentAttendees] = useState<AttendeeRow[]>([]);
  const [attendeesTotal, setAttendeesTotal] = useState(0);
  const [attendeesLoaded, setAttendeesLoaded] = useState(false);
  const attendeesLoading = userRole && hasMinRole(userRole, "facilitator") ? !attendeesLoaded : false;
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [speakerProfileId, setSpeakerProfileId] = useState<number | null>(null);

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
    if (!isLoaded || !isSignedIn || !user) return;

    fetchEventAccess(eventId, user).then((access) => {
      setHasTicket(access.hasTicket);
      if (access.speakerProfileId) setSpeakerProfileId(access.speakerProfileId);
    });

    if (hasMinRole(user.role, "facilitator")) {
      fetch(`/api/events/${eventId}/attendees?limit=5`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setRecentAttendees(data.attendees);
            setAttendeesTotal(data.total);
          }
          setAttendeesLoaded(true);
        })
        .catch(() => setAttendeesLoaded(true));
    }
  }, [eventId, isLoaded, isSignedIn, user]);

  const isSpeakerAssigned =
    (speakerProfileId && event?.EVENT_SPEAKER?.some((es) => es.SPEAKER_PROFILE.id === speakerProfileId)) ?? false;

  const eventStarted = event ? new Date(`${event.event_date}T${event.start_time}`) <= new Date() : true;

  const badgeProps = event ? getBadgeProps(event) : null;

  const isFacilitator = hasMinRole(userRole, "facilitator");
  const showCountdown = event?.status === "active";

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

  return {
    event,
    loading,
    error,
    userRole,
    hasTicket,
    isSpeakerAssigned,
    eventStarted,
    badgeProps,
    isFacilitator,
    showCountdown,
    isSignedIn,
    recentAttendees,
    attendeesTotal,
    attendeesLoading,
    publishing,
    publishError,
    deleteError,
    handleRegister,
    handlePublish,
    handleDelete,
  };
}
