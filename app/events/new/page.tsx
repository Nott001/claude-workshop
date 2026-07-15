"use client";

import { useState, useRef } from "react";
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
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      price: price ? Number(price) : 0,
      currency,
      cover_image_url: coverImageFile ? null : coverImageUrl || null,
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

    const event = await res.json();

    if (coverImageFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", coverImageFile);
      formData.append("event_id", String(event.event_id));

      const uploadRes = await fetch("/api/upload/event-image", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        setError("Event created but cover image upload failed. You can add it later via edit.");
        setUploading(false);
        router.push(`/events/${event.event_id}`);
        return;
      }
      setUploading(false);
    }

    router.push("/events");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      setCoverImageUrl("");
    }
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
        <div>
          <label>Price</label>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label>Currency</label>
          <input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label>Cover Image</label>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} />
          {coverImageFile && <p>Selected: {coverImageFile.name}</p>}
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => {
              setCoverImageUrl(e.target.value);
              setCoverImageFile(null);
            }}
            placeholder="Or paste image URL"
          />
        </div>
        <button type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Create Event"}
        </button>
      </form>
    </div>
  );
}
