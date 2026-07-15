"use client";

import { useEffect, useState, useRef } from "react";
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
  price: number;
  currency: string;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
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
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"draft" | "active" | "complete">("draft");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setPrice(String(data.price ?? 0));
      setCurrency(data.currency ?? "PHP");
      setCoverImageUrl(data.cover_image_url ?? "");
      setStatus(data.status);
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
      price: price ? Number(price) : 0,
      currency,
      cover_image_url: coverImageFile ? undefined : coverImageUrl || null,
      status,
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

    if (coverImageFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", coverImageFile);
      formData.append("event_id", eventId);

      const uploadRes = await fetch("/api/upload/event-image", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        setError("Event updated but cover image upload failed.");
        setUploading(false);
        router.push(`/events/${eventId}`);
        return;
      }
      setUploading(false);
    }

    router.push(`/events/${eventId}`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      setCoverImageUrl("");
    }
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
          {coverImageUrl && !coverImageFile && (
            <div>
              <img src={coverImageUrl} alt="Current cover" style={{ maxWidth: "200px" }} />
            </div>
          )}
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
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active" | "complete")}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
          </select>
        </div>
        <button type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Update Event"}
        </button>
      </form>
    </div>
  );
}
