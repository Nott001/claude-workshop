"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import type { Event } from "@/types";
import { Footer } from "@/components/footer";
import { KioskEventSelector } from "@/modules/kiosk/ui/kiosk-event-selector";
import { KioskScannerView } from "@/modules/kiosk/ui/kiosk-scanner-view";

export default function KioskPage() {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        if (data.role !== "facilitator") {
          router.push("/");
        }
      });
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (userRole !== "facilitator") return;
    fetch("/api/events?filter=upcoming")
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load events")))
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch((err) => setEventsError(typeof err === "string" ? err : "Failed to load events"))
      .finally(() => setEventsLoading(false));
  }, [userRole]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
      </div>
    );
  }

  if (userRole !== "facilitator") return null;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-[20px] text-brand">bolt</span>
          <span className="text-sm font-bold tracking-tight text-fg">StartupLab — Kiosk mode</span>
        </div>
        {selectedEvent && (
          <div className="flex items-center gap-3">
            <span className="truncate max-w-[200px] text-sm font-medium text-fg">{selectedEvent.title}</span>
            <button
              onClick={() => setSelectedEvent(null)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-muted-fg transition hover:border-brand hover:text-brand"
            >
              <span className="material-symbols-rounded text-[14px]">swap_horiz</span>
              Change
            </button>
          </div>
        )}
      </div>

      {!selectedEvent ? (
        <KioskEventSelector events={events} eventsLoading={eventsLoading} error={eventsError} onSelect={setSelectedEvent} />
      ) : (
        <KioskScannerView selectedEvent={selectedEvent} onChangeEvent={() => setSelectedEvent(null)} />
      )}

      <Footer role="facilitator" />
    </div>
  );
}
