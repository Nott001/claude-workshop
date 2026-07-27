"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SpeakerProfile {
  speaker_profile_id: number;
  USERS: { full_name: string; email: string } | null;
  bio: string | null;
  designation: string | null;
}

interface Course {
  course_id: number;
  course_name: string;
  course_description: string | null;
}

export function useEventCreate() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([]);
  const [speakerId, setSpeakerId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetch("/api/speakers")
      .then((res) => (res.ok ? res.json() : []))
      .then(setSpeakers)
      .catch(() => {});

    fetch("/api/courses")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error?.message ?? body.error ?? `Failed to load courses (${r.status})`);
        }
        return r.json();
      })
      .then(setCourses)
      .catch((err) => setCoursesError(err instanceof Error ? err.message : "Failed to load courses"));
  }, []);

  function handleCoverFileSelect(file: File) {
    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  }

  function handleCoverRemove() {
    setCoverImageFile(null);
    setCoverImagePreview(null);
  }

  function buildEventBody() {
    return {
      title,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      venue_name: venueName,
      venue_address: venueAddress || null,
      description: description || null,
      course_id: courseId && courseId !== "__none__" ? Number(courseId) : null,
      price: price ? Number(price) : 0,
      currency,
      cover_image_url: null as string | null,
      status: "draft" as const,
    };
  }

  async function createEvent() {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody()),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to create event");
    }

    return res.json();
  }

  async function uploadCoverImage(eventId: number) {
    if (!coverImageFile) return;
    const formData = new FormData();
    formData.append("file", coverImageFile);
    formData.append("event_id", String(eventId));

    const uploadRes = await fetch("/api/upload/event-image", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error("Event created but cover image upload failed. You can add it later via edit.");
    }
  }

  async function assignSpeaker(eventId: number) {
    if (!speakerId) return;
    await fetch(`/api/events/${eventId}/speakers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speaker_profile_id: Number(speakerId) }),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const event = await createEvent();
      await Promise.all([assignSpeaker(event.event_id), uploadCoverImage(event.event_id)]);

      const publishRes = await fetch(`/api/events/${event.event_id}/publish`, { method: "POST" });
      if (!publishRes.ok) {
        const data = await publishRes.json();
        throw new Error(data.error?.message ?? "Event created but failed to publish");
      }

      setShowToast(true);
      setTimeout(() => router.push(`/events/${event.event_id}`), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    setError(null);

    try {
      await createEvent();
      router.push("/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  }

  return {
    title,
    setTitle,
    eventDate,
    setEventDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    venueName,
    setVenueName,
    venueAddress,
    setVenueAddress,
    description,
    setDescription,
    courseId,
    setCourseId,
    price,
    setPrice,
    currency,
    setCurrency,
    coverImagePreview,
    error,
    speakers,
    speakerId,
    setSpeakerId,
    courses,
    coursesError,
    submitting,
    showToast,
    handleCoverFileSelect,
    handleCoverRemove,
    handleSubmit,
    handleSaveDraft,
  };
}
