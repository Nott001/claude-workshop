"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);

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

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Failed to create event");
      return;
    }

    router.push("/events");
  }

  return (
    <div>
      <button onClick={() => router.push("/events")}>&larr; Back to Events</button>
      <h1>Create Event</h1>

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
        <button type="submit">Create Event</button>
      </form>
    </div>
  );
}
