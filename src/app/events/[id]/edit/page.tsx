"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Footer } from "@/components/footer";
import { HeroImageUploader } from "@/modules/event-management/ui/hero-image-uploader";
import { CourseSelect } from "@/modules/event-management/ui/course-select";
import { SpeakerSelect } from "@/modules/event-management/ui/speaker-select";

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

    setSubmitting(false);
    router.push(`/events/${eventId}`);
  }

  function handleCoverFileSelect(file: File) {
    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  }

  function handleCoverRemove() {
    setCoverImageFile(null);
    setCoverImagePreview(null);
    setExistingCoverUrl(null);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <p className="text-sm text-muted-foreground">Loading event...</p>
      </div>
    );
  }

  const previewSrc = coverImagePreview ?? existingCoverUrl;

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Event
          </button>

          <div className="mb-12">
            <h1 className="text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Edit Event</h1>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-10 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
            <Form onSubmit={handleSubmit} className="space-y-8">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="rounded-lg bg-info/10 p-2">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M4 2.5C3.17157 2.5 2.5 3.17157 2.5 4V16C2.5 16.8284 3.17157 17.5 4 17.5H16C16.8284 17.5 17.5 16.8284 17.5 16V8.5C17.5 7.67157 16.8284 7 16 7H12V4C12 3.17157 11.3284 2.5 10.5 2.5H4ZM10.5 9C10.7761 9 11 9.22386 11 9.5V13.5C11 13.7761 10.7761 14 10.5 14H4.5C4.22386 14 4 13.7761 4 13.5V9.5C4 9.22386 4.22386 9 4.5 9H10.5Z"
                      fill="#29B6F6"
                    />
                  </svg>
                </div>
                <span className="text-xs font-bold tracking-[0.1em] text-fg">EVENT FOUNDATIONS</span>
              </div>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Event Hero Image</FormLabel>
                <HeroImageUploader preview={previewSrc} onFileSelect={handleCoverFileSelect} onRemove={handleCoverRemove} />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Event Name</FormLabel>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Startup Fundraising Masterclass"
                  className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                  required
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Link to Curriculum Library (Optional)</FormLabel>
                <CourseSelect
                  value={courseId}
                  onValueChange={setCourseId}
                  courses={courses}
                  error={coursesError}
                  onNoCoursesAction={() => router.push("/courses/new")}
                />
              </FormField>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">Date</FormLabel>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">Start Time</FormLabel>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">End Time</FormLabel>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                    required
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">Venue Name</FormLabel>
                  <Input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g. StartupLab Main Hall"
                    className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                    required
                  />
                </FormField>

                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">Venue Address</FormLabel>
                  <Input
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="Optional"
                    className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">Price</FormLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0 for free"
                    className="rounded-lg border-border bg-surface px-4 py-3 text-base text-fg"
                  />
                </FormField>

                <FormField>
                  <FormLabel className="text-sm font-semibold text-fg">Currency</FormLabel>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full rounded-lg border-border bg-surface px-4 py-3 text-base text-fg">
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
                <FormLabel className="text-sm font-semibold text-fg">Speaker Assignment</FormLabel>
                <SpeakerSelect value={speakerId} onValueChange={setSpeakerId} speakers={speakers} includeNone />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Description</FormLabel>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe the purpose of this event..."
                  className="min-h-[88px] rounded-lg border-border bg-muted px-4 py-3 text-base text-fg"
                />
              </FormField>

              <FormField>
                <FormLabel className="text-sm font-semibold text-fg">Status</FormLabel>
                <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "active" | "complete")}>
                  <SelectTrigger className="w-full rounded-lg border-border bg-surface px-4 py-3 text-base text-fg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <div className="flex items-center justify-end gap-6 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push(`/events/${eventId}`)}
                  disabled={submitting || uploading}
                  className="text-sm font-semibold text-muted-fg"
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
                  className="rounded-lg px-8 py-3 text-base font-bold leading-6 text-white transition-colors hover:bg-brand/90"
                >
                  {submitting ? "Saving..." : uploading ? "Uploading..." : "Save Changes"}
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </div>
      <Footer role="facilitator" />
    </>
  );
}
