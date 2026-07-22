"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Toast } from "@/components/toast";
import { cn } from "@/lib/utils";

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

export default function NewEventPage() {
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
  const [dragOver, setDragOver] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setCoverImageFile(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  }

  async function createEvent() {
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
      cover_image_url: null as string | null,
      status: "draft" as const,
    };

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to create event");
    }

    return await res.json();
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

  return (
    <div className="flex flex-1 flex-col bg-[#FBF9F8] px-5 py-12 sm:px-8 md:px-12">
      <div className="mx-auto w-full max-w-[896px]">
        <button
          onClick={() => router.push("/events")}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Events
        </button>

        <div className="mb-12">
          <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-[#0F172A]">Create New Event</h1>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[#F3F4F6] bg-white p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
          <Form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center gap-3 border-b border-[#F9FAFB] pb-4">
              <div className="rounded-lg bg-blue-50 p-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4 2.5C3.17157 2.5 2.5 3.17157 2.5 4V16C2.5 16.8284 3.17157 17.5 4 17.5H16C16.8284 17.5 17.5 16.8284 17.5 16V8.5C17.5 7.67157 16.8284 7 16 7H12V4C12 3.17157 11.3284 2.5 10.5 2.5H4ZM10.5 9C10.7761 9 11 9.22386 11 9.5V13.5C11 13.7761 10.7761 14 10.5 14H4.5C4.22386 14 4 13.7761 4 13.5V9.5C4 9.22386 4.22386 9 4.5 9H10.5Z"
                    fill="#29B6F6"
                  />
                </svg>
              </div>
              <span className="text-xs font-bold tracking-[0.1em] text-[#334155]">EVENT FOUNDATIONS</span>
            </div>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Event Hero Image</FormLabel>
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
                  dragOver ? "border-accent bg-accent/5" : "border-[#D1D5DB]",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {coverImagePreview ? (
                  <div className="relative w-full max-w-md">
                    <img src={coverImagePreview} alt="Hero preview" className="max-h-48 w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverImageFile(null);
                        setCoverImagePreview(null);
                      }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                    >
                      <span className="material-symbols-rounded text-[16px]">close</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-2">
                      <path
                        d="M24 16v12m-6-6h12m10-6v16a4 4 0 01-4 4H12a4 4 0 01-4-4V22a4 4 0 014-4h3l3-4h6m12 0v6"
                        stroke="#29B6F6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-medium text-[#29B6F6]">Upload a hero image</span>
                      <span className="text-sm text-[#4B5563]">or drag and drop</span>
                    </div>
                    <span className="mt-1 text-xs text-[#6B7280]">PNG, JPG, GIF up to 10MB</span>
                  </>
                )}
              </div>
            </FormField>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Event Name</FormLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Startup Fundraising Masterclass"
                className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                required
              />
            </FormField>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Link to Curriculum Library (Optional)</FormLabel>
              <p className="mb-1 text-xs font-medium text-[#2563EB]">
                Connect this event to an existing curriculum for automatic resource sharing.
              </p>
              {coursesError && <p className="mb-2 text-xs text-red-600">{coursesError}</p>}
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="mt-3 w-full rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]">
                  <SelectValue placeholder="No curriculum linked">
                    {(value: string) => {
                      if (!value || value === "__none__") return "No curriculum linked";
                      return courses.find((c) => String(c.course_id) === value)?.course_name ?? "No curriculum linked";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None — no curriculum</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.course_id} value={String(c.course_id)}>
                      {c.course_name}
                    </SelectItem>
                  ))}
                  {courses.length === 0 && !coursesError && (
                    <SelectItem value="__create__" disabled>
                      No courses available — create one first
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {courses.length === 0 && !coursesError && (
                <p className="mt-2 text-xs text-[#6B7280]">
                  No courses available.{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/courses/new")}
                    className="font-medium text-[#2563EB] underline underline-offset-2 hover:text-[#1d4ed8]"
                  >
                    Create a course
                  </button>
                </p>
              )}
            </FormField>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Date</FormLabel>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Start Time</FormLabel>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">End Time</FormLabel>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Venue Name</FormLabel>
                <Input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g. StartupLab Main Hall"
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Venue Address</FormLabel>
                <Input
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Optional"
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Price</FormLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0 for free"
                  className="rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]"
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-[#334155]">Currency</FormLabel>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHP">PHP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Speaker Assignment</FormLabel>
              {speakers.length > 0 ? (
                <Select value={speakerId} onValueChange={setSpeakerId}>
                  <SelectTrigger className="w-full rounded-lg border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-base text-[#374151]">
                    <SelectValue placeholder="Select a speaker">
                      {(value) => {
                        const s = speakers.find((sp) => String(sp.speaker_profile_id) === value);
                        return s
                          ? `${s.USERS?.full_name ?? `Speaker #${s.speaker_profile_id}`}${s.designation ? ` (${s.designation})` : ""}`
                          : "Select a speaker";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {speakers.map((s) => (
                      <SelectItem key={s.speaker_profile_id} value={String(s.speaker_profile_id)}>
                        {s.USERS?.full_name ?? `Speaker #${s.speaker_profile_id}`}
                        {s.designation ? ` (${s.designation})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={speakerId}
                  onChange={(e) => setSpeakerId(e.target.value)}
                  placeholder="Speaker profile ID (optional)"
                  className="rounded-lg border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-base text-[#374151]"
                />
              )}
            </FormField>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Description</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the purpose of this event..."
                className="min-h-[88px] rounded-lg border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-base text-[#374151]"
              />
            </FormField>

            <div className="flex items-center justify-end gap-6 border-t border-[#F9FAFB] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="text-sm font-semibold text-[#6B7280]"
              >
                Save Draft
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: "#29B6F6",
                  boxShadow: "0 4px 6px -4px rgba(191, 219, 254, 1), 0 10px 15px -3px rgba(191, 219, 254, 1)",
                }}
                className="rounded-lg px-8 py-3 text-base font-bold leading-6 text-white transition-colors hover:bg-[#239dce]"
              >
                {submitting ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </Form>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-4 right-4 z-50">
          <Toast title="Event published successfully!" />
        </div>
      )}
    </div>
  );
}
