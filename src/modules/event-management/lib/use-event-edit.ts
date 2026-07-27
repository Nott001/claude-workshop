"use client";

import { useEffect, useState } from "react";
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

interface EventData {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  description: string | null;
  course_id: number | null;
  price: number;
  currency: string;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
}

export function useEventEdit(eventId: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [courseId, setCourseId] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [description, setDescription] = useState("");
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"draft" | "active" | "complete">("draft");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([]);
  const [speakerId, setSpeakerId] = useState("");

  useEffect(() => {
    async function load() {
      const [eventRes, coursesRes, speakersRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch("/api/courses"),
        fetch("/api/speakers"),
      ]);

      const allCourses = coursesRes.ok ? await coursesRes.json() : [];
      setCourses(allCourses);
      if (!coursesRes.ok) {
        const body = await coursesRes.json().catch(() => ({}));
        setCoursesError(body.error?.message ?? body.error ?? `Failed to load courses (${coursesRes.status})`);
      }

      const allSpeakers = speakersRes.ok ? await speakersRes.json() : [];
      setSpeakers(allSpeakers);

      if (!eventRes.ok) {
        setError("Event not found");
        setLoading(false);
        return;
      }
      const data: EventData = await eventRes.json();
      setTitle(data.title);
      setEventDate(data.event_date);
      setStartTime(data.start_time);
      setEndTime(data.end_time);
      setVenueName(data.venue_name);
      setVenueAddress(data.venue_address ?? "");
      setCourseId(data.course_id ? String(data.course_id) : "__none__");
      setPrice(String(data.price ?? 0));
      setCurrency(data.currency ?? "PHP");
      setDescription(data.description ?? "");
      setExistingCoverUrl(data.cover_image_url);
      setStatus(data.status);
      setLoading(false);

      const assignmentsRes = await fetch(`/api/events/${eventId}/speakers`);
      if (assignmentsRes.ok) {
        const assignments = await assignmentsRes.json();
        if (assignments.length > 0 && assignments[0].speaker_profile_id) {
          setSpeakerId(String(assignments[0].speaker_profile_id));
        }
      }
    }
    load();
  }, [eventId]);

  function handleCoverFileSelect(file: File) {
    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  }

  function handleCoverRemove() {
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setExistingCoverUrl(null);
  }

  async function updateEvent() {
    const body = {
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
      cover_image_url: coverImageFile ? undefined : existingCoverUrl,
      status,
    };

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to update event");
    }
  }

  async function uploadImage() {
    if (!coverImageFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", coverImageFile);
      formData.append("event_id", eventId);

      const res = await fetch("/api/upload/event-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Event updated but cover image upload failed.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function syncSpeaker() {
    const assignmentRes = await fetch(`/api/events/${eventId}/speakers`);
    const currentAssignments = assignmentRes.ok ? await assignmentRes.json() : [];
    const currentSpeakerId = currentAssignments.length > 0 ? String(currentAssignments[0].speaker_profile_id) : "";

    if (speakerId && speakerId !== currentSpeakerId) {
      if (currentSpeakerId) {
        await fetch(`/api/events/${eventId}/speakers/${currentSpeakerId}`, { method: "DELETE" });
      }
      await fetch(`/api/events/${eventId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_profile_id: Number(speakerId) }),
      });
    } else if (!speakerId && currentSpeakerId) {
      await fetch(`/api/events/${eventId}/speakers/${currentSpeakerId}`, { method: "DELETE" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await updateEvent();
      await uploadImage();
      await syncSpeaker();
      setSubmitting(false);
      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  }

  const previewSrc = coverImagePreview ?? existingCoverUrl;

  return {
    loading,
    error,
    submitting,
    uploading,
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
    courseId,
    setCourseId,
    price,
    setPrice,
    currency,
    setCurrency,
    description,
    setDescription,
    status,
    setStatus,
    courses,
    coursesError,
    speakers,
    speakerId,
    setSpeakerId,
    previewSrc,
    handleCoverFileSelect,
    handleCoverRemove,
    handleSubmit,
  };
}
