"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { useEffect, useState } from "react";
import type { Event } from "@/shared/types";

export default function StaffEventKioskPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { isLoaded, isSignedIn, user } = useSession();
  const userRole = user?.role ?? null;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !hasMinRole(userRole, "facilitator")) {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, userRole, router]);

  useEffect(() => {
    if (!hasMinRole(userRole, "facilitator")) return;
    fetch("/api/events?filter=upcoming")
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load event")))
      .then((data) => {
        const found = Array.isArray(data) ? data.find((e: Event) => String(e.id) === eventId) : null;
        setEvent(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userRole, eventId]);

  if (!isLoaded || loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
      </div>
    );
  }

  if (!hasMinRole(userRole, "facilitator")) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-[20px] text-brand">bolt</span>
          <span className="text-sm font-bold tracking-tight text-fg">StartupLab — Kiosk mode</span>
        </div>
        {event && (
          <div className="flex items-center gap-3">
            <span className="truncate max-w-[200px] text-sm font-medium text-fg">{event.title}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-8">
        {!event ? (
          <p className="text-sm text-muted-fg">Event not found or unavailable.</p>
        ) : (
          <>
            <span className="material-symbols-rounded text-6xl text-brand">qr_code_scanner</span>
            <p className="mt-4 text-sm text-muted-fg">
              Scanning tickets for <strong>{event.title}</strong>
            </p>
            <p className="mt-2 text-xs text-muted-fg">{event.event_date}</p>
          </>
        )}
      </div>
    </div>
  );
}
