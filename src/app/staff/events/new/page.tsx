"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "@/shared/components/footer";
import { Toast } from "@/shared/components/toast";
import { useSession } from "@/modules/auth";

export default function StaffNewEventPage() {
  const router = useRouter();
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, event_date: eventDate, start_time: startTime, end_time: endTime, venue_name: venueName }),
      });
      if (!res.ok) throw new Error("Failed to create event");
      setShowToast(true);
      setTimeout(() => router.push("/staff/events"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[896px]">
          <button
            onClick={() => router.push("/staff/events")}
            className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="material-symbols-rounded text-[16px]">arrow_back</span>
            Back to Events
          </button>

          <h1 className="mb-8 text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-fg">Create Event</h1>

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
              {submitting ? "Creating..." : "Create Event"}
            </button>
          </form>
        </div>

        {showToast && (
          <div className="fixed bottom-4 right-4 z-50">
            <Toast title="Event created successfully!" />
          </div>
        )}
      </div>
      <Footer role={user?.role as "facilitator" | "speaker" | "attendee"} />
    </>
  );
}
