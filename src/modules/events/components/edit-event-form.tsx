"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/shared/components/footer";

interface EditEventFormProps {
  eventId: string;
  initialData: {
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
  };
}

export function EditEventForm({ eventId, initialData }: EditEventFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [eventDate, setEventDate] = useState(initialData.event_date);
  const [startTime, setStartTime] = useState(initialData.start_time);
  const [endTime, setEndTime] = useState(initialData.end_time);
  const [venueName, setVenueName] = useState(initialData.venue_name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, event_date: eventDate, start_time: startTime, end_time: endTime, venue_name: venueName }),
      });
      if (!res.ok) throw new Error("Failed to update event");
      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setSubmitting(false);
    }
  }

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

          <h1 className="mb-8 text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Edit Event</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-fg">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-fg">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-fg">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Venue</label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
      <Footer role="facilitator" />
    </>
  );
}
