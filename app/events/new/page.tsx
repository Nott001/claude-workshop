"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

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
        setError(
          "Event created but cover image upload failed. You can add it later via edit.",
        );
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
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-4">
        <button
          onClick={() => router.push("/events")}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          Back to Events
        </button>
        <h1 className="text-base font-bold text-foreground">Create Event</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <FormField>
          <FormLabel>Event title</FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q4 Venture Fund Pitch"
            required
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField>
            <FormLabel>Event date</FormLabel>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </FormField>
          <FormField>
            <FormLabel>Linked course</FormLabel>
            <Input
              type="number"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder="Optional"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField>
            <FormLabel>Start time</FormLabel>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </FormField>
          <FormField>
            <FormLabel>End time</FormLabel>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </FormField>
        </div>

        <FormField>
          <FormLabel>Venue name</FormLabel>
          <Input
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="e.g. StartupLab Main Hall"
            required
          />
        </FormField>

        <FormField>
          <FormLabel>Venue address</FormLabel>
          <Input
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            placeholder="Optional"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField>
            <FormLabel>Price</FormLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0 for free"
            />
          </FormField>
          <FormField>
            <FormLabel>Currency</FormLabel>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full">
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
          <FormLabel>Cover image</FormLabel>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              className="text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
            />
            {coverImageFile && (
              <span className="text-xs text-muted-foreground">
                {coverImageFile.name}
              </span>
            )}
          </div>
          <Input
            type="url"
            value={coverImageUrl}
            onChange={(e) => {
              setCoverImageUrl(e.target.value);
              setCoverImageFile(null);
            }}
            placeholder="Or paste image URL"
            className="mt-1.5"
          />
        </FormField>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={uploading}>
            <span className="material-symbols-rounded text-[16px]">
              {uploading ? "cloud_upload" : "add_circle"}
            </span>
            {uploading ? "Uploading..." : "Create event"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/events")}
          >
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}
