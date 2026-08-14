"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { withBackLink, type BackLinkOrigin } from "@/shared/lib/back-link";
import { getBadgeProps } from "@/modules/events/lib/schemas";
import { parseLocalDateTime } from "@/shared/lib/date-utils";
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

/** `backOrigin` is carried into every hop this hook navigates to, so a reader
 *  who registers or signs up still lands back where they started. */
export function useEventDetail(eventId: string, backOrigin?: BackLinkOrigin) {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [event, setEvent] = useState<EventWithCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [recentAttendees, setRecentAttendees] = useState<AttendeeRow[]>([]);
  const [attendeesTotal, setAttendeesTotal] = useState(0);
  const [attendeesLoaded, setAttendeesLoaded] = useState(false);
  const attendeesLoading = userRole && hasMinRole(userRole, ROLES.FACILITATOR) ? !attendeesLoaded : false;
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
      // /api/events/[id] answers the ticket and speaker facts alongside the
      // event, so access needs no second round-trip and no paged ticket list.
      setHasTicket(data.hasTicket ?? false);
      if (data.speakerProfileId) setSpeakerProfileId(data.speakerProfileId);
      setEvent(data);
      setLoading(false);
    }
    load();
  }, [eventId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    if (hasMinRole(user.role, ROLES.FACILITATOR)) {
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
    speakerProfileId != null && (event?.EVENT_SPEAKER?.some((es) => es.SPEAKER_PROFILE.id === speakerProfileId) ?? false);

  const eventStart = event ? parseLocalDateTime(event.event_date, event.start_time) : null;
  const eventStarted = event ? (eventStart ? eventStart <= new Date() : false) : true;

  const badgeProps = event ? getBadgeProps(event) : null;

  const isFacilitator = hasMinRole(userRole, ROLES.FACILITATOR);
  const showCountdown = event?.status === "active";

  async function handleRegister() {
    if (!isSignedIn) {
      // Encoded, not interpolated: the return path now carries a query of its
      // own, which raw would read as a second parameter of /sign-up.
      router.push(`/sign-up${redirectUrlParam(withBackLink(`/events/${eventId}`, backOrigin))}`);
      return;
    }
    router.push(withBackLink(`/events/${eventId}/register`, backOrigin));
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
