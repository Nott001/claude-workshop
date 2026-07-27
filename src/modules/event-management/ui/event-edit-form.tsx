"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { HeroImageUploader } from "@/modules/event-management/ui/hero-image-uploader";
import { CourseSelect } from "@/modules/event-management/ui/course-select";
import { SpeakerSelect } from "@/modules/event-management/ui/speaker-select";

interface Course {
  course_id: number;
  course_name: string;
  course_description: string | null;
}

interface SpeakerProfile {
  speaker_profile_id: number;
  USERS: { full_name: string; email: string } | null;
  bio: string | null;
  designation: string | null;
}

interface EventEditFormProps {
  title: string;
  setTitle: (v: string) => void;
  eventDate: string;
  setEventDate: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  venueName: string;
  setVenueName: (v: string) => void;
  venueAddress: string;
  setVenueAddress: (v: string) => void;
  courseId: string;
  setCourseId: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  status: "draft" | "active" | "complete";
  setStatus: (v: "draft" | "active" | "complete") => void;
  courses: Course[];
  coursesError: string | null;
  speakers: SpeakerProfile[];
  speakerId: string;
  setSpeakerId: (v: string) => void;
  previewSrc: string | null;
  handleCoverFileSelect: (file: File) => void;
  handleCoverRemove: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  uploading: boolean;
  error: string | null;
  onCancel: () => void;
}

export function EventEditForm({
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
  submitting,
  uploading,
  error,
  onCancel,
}: EventEditFormProps) {
  return (
    <>
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
              onNoCoursesAction={() => {}}
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
              onClick={onCancel}
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
    </>
  );
}
