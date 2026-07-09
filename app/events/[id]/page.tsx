"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

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
  COURSE: Course | null;
  EVENT_SPEAKERS: EventSpeaker[];
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn } = useUser();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeleteError(null);
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (res.status === 409) {
      const body = await res.json();
      setDeleteError(body.error ?? "Cannot delete: event has payments");
      return;
    }
    if (!res.ok) {
      setDeleteError("Failed to delete event");
      return;
    }
    router.push("/events");
  }

  if (loading) return <div>Loading event...</div>;
  if (error || !event) return <div>{error ?? "Event not found"}</div>;

  return (
    <div>
      <button onClick={() => router.push("/events")}>&larr; Back to Events</button>

      <h1>{event.title}</h1>

      <div>
        <h2>Date & Time</h2>
        <p>{event.event_date}</p>
        <p>
          {event.start_time} - {event.end_time}
        </p>
      </div>

      <div>
        <h2>Venue</h2>
        <p>{event.venue_name}</p>
        {event.venue_address && <p>{event.venue_address}</p>}
      </div>

      {event.COURSE && (
        <div>
          <h2>Course</h2>
          <p>{event.COURSE.course_name}</p>
          {event.COURSE.course_description && <p>{event.COURSE.course_description}</p>}
        </div>
      )}

      <div>
        <h2>Speakers</h2>
        {event.EVENT_SPEAKERS.length === 0 ? (
          <p>No speakers assigned.</p>
        ) : (
          <ul>
            {event.EVENT_SPEAKERS.map((es) => (
              <li key={es.SPEAKER_PROFILES.speaker_profile_id}>
                {es.SPEAKER_PROFILES.designation && <span>{es.SPEAKER_PROFILES.designation}</span>}
                {es.SPEAKER_PROFILES.bio && <p>{es.SPEAKER_PROFILES.bio}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isLoaded && isSignedIn && (
        <div>
          <button onClick={() => router.push(`/events/${eventId}/edit`)}>Edit Event</button>
          <button onClick={() => router.push(`/events/${eventId}/speakers`)}>Manage Speakers</button>
          <button onClick={handleDelete}>Delete Event</button>
        </div>
      )}

      {deleteError && <p>{deleteError}</p>}
    </div>
  );
}
