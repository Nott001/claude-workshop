"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface Event {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  course_id: number | null;
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) {
        setError("Event not found");
        setLoading(false);
        return;
      }
      const data: Event = await res.json();
      setTitle(data.title);
      setEventDate(data.event_date);
      setStartTime(data.start_time);
      setEndTime(data.end_time);
      setVenueName(data.venue_name);
      setVenueAddress(data.venue_address ?? "");
      setCourseId(data.course_id ? String(data.course_id) : "");
      setLoading(false);
    }
    load();
  }, [eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body = {
      title,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      venue_name: venueName,
      venue_address: venueAddress || null,
      course_id: courseId ? Number(courseId) : null,
    };

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Failed to update event");
      return;
    }

    router.push(`/events/${eventId}`);
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <button onClick={() => router.push(`/events/${eventId}`)}>&larr; Back to Event</button>
      <h1>Edit Event</h1>

      {error && <p>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label>Event Date</label>
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </div>
        <div>
          <label>Start Time</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <label>End Time</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
        <div>
          <label>Venue Name</label>
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} required />
        </div>
        <div>
          <label>Venue Address</label>
          <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
        </div>
        <div>
          <label>Course ID (optional)</label>
          <input type="number" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
        </div>
        <button type="submit">Update Event</button>
      </form>
    </div>
  );
}
