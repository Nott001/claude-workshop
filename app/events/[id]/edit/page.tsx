"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface Event {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  description: string | null;
  overview: string | null;
  course_id: number | null;
  price: number;
  currency: string;
  cover_image_url: string | null;
  status: "draft" | "active" | "complete";
}

interface Course {
  course_id: number;
  course_name: string;
  course_description: string | null;
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
  const [currency, setCurrency] = useState("PHP");
  const [description, setDescription] = useState("");
  const [overview, setOverview] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"draft" | "active" | "complete">("draft");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const [eventRes, coursesRes, eventsRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch("/api/courses"),
        fetch("/api/events"),
      ]);

      setCoursesError(null);
      if (!coursesRes.ok) {
        const body = await coursesRes.json().catch(() => ({}));
        setCoursesError(body.error?.message ?? body.error ?? `Failed to load courses (${coursesRes.status})`);
      } else if (eventsRes.ok) {
        const [allCourses, allEvents] = await Promise.all([coursesRes.json(), eventsRes.json()]);
        const linkedIds = new Set(
          allEvents
            .filter((e: { event_id: number }) => e.event_id !== Number(eventId))
            .map((e: { course_id: number | null }) => e.course_id)
            .filter((id): id is number => id != null),
        );
        setCourses(allCourses.filter((c: Course) => !linkedIds.has(c.course_id)));
      } else {
        const allCourses = await coursesRes.json();
        setCourses(allCourses);
      }

      if (!eventRes.ok) {
        setError("Event not found");
        setLoading(false);
        return;
      }
      const data: Event = await eventRes.json();
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
      setOverview(data.overview ?? "");
      setCoverImageUrl(data.cover_image_url ?? "");
      setStatus(data.status);
      setLoading(false);
    }
    load();
  }, [eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      title,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      venue_name: venueName,
      venue_address: venueAddress || null,
      description: description || null,
      overview: overview || null,
      course_id: courseId && courseId !== "__none__" ? Number(courseId) : null,
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
      setSubmitting(false);
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
        setSubmitting(false);
        return;
      }
      setUploading(false);
    }

    setSubmitting(false);
    router.push(`/events/${eventId}`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      setCoverImageUrl("");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#FBF9F8]">
        <p className="text-sm text-muted-foreground">Loading event...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#FBF9F8] px-5 py-12 sm:px-8 md:px-12">
      <div className="mx-auto w-full max-w-[896px]">
        <button
          onClick={() => router.push(`/events/${eventId}`)}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Event
        </button>

        <div className="mb-12">
          <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-[#0F172A]">Edit Event</h1>
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
                <span className="material-symbols-rounded text-[20px] text-[#29B6F6]">event</span>
              </div>
              <span className="text-xs font-bold tracking-[0.1em] text-[#334155]">EVENT DETAILS</span>
            </div>

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
              <FormLabel className="text-sm font-semibold text-[#334155]">Link to Curriculum Library (Optional)</FormLabel>
              <p className="mb-1 text-xs font-medium text-[#2563EB]">
                Connect this event to an existing curriculum for automatic resource sharing.
              </p>
              {coursesError && <p className="mb-2 text-xs text-red-600">{coursesError}</p>}
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="mt-3 w-full rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]">
                  <SelectValue placeholder="No curriculum linked" />
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

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Description</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the purpose of this event..."
                className="min-h-[88px] rounded-lg border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-base text-[#374151]"
              />
            </FormField>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Overview</FormLabel>
              <Textarea
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="Provide a detailed agenda or session breakdown..."
                className="min-h-[108px] rounded-lg border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-base text-[#374151]"
              />
            </FormField>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Cover Image</FormLabel>
              {coverImageUrl && !coverImageFile && (
                <div className="mb-3">
                  <img src={coverImageUrl} alt="Current cover" className="max-h-40 rounded-lg object-cover" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                className="text-sm text-[#6B7280]"
              />
              {coverImageFile && <p className="mt-1 text-xs text-[#6B7280]">Selected: {coverImageFile.name}</p>}
            </FormField>

            <FormField>
              <FormLabel className="text-sm font-semibold text-[#334155]">Status</FormLabel>
              <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "active" | "complete")}>
                <SelectTrigger className="w-full rounded-lg border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#374151]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div className="flex items-center justify-end gap-6 border-t border-[#F9FAFB] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(`/events/${eventId}`)}
                disabled={submitting || uploading}
                className="text-sm font-semibold text-[#6B7280]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploading}
                style={{
                  backgroundColor: "#29B6F6",
                  boxShadow: "0 4px 6px -4px rgba(191, 219, 254, 1), 0 10px 15px -3px rgba(191, 219, 254, 1)",
                }}
                className="rounded-lg px-8 py-3 text-base font-bold leading-6 text-white transition-colors hover:bg-[#239dce]"
              >
                {submitting ? "Saving..." : uploading ? "Uploading..." : "Save Changes"}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
