"use client";

import { ROLES } from "@/shared/lib/roles";
import { useParams, useRouter } from "next/navigation";
import { KioskScannerView } from "@/modules/kiosk/components/kiosk-scanner-view";
import { KioskBar } from "@/modules/kiosk/components/kiosk-bar";
import { useCallback, useEffect, useState } from "react";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import type { Event } from "@/shared/types";

export default function StaffEventKioskPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { pending, allowed } = useRoleGuard(ROLES.FACILITATOR);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    // One event by id. Scanning page one of ?filter=upcoming lost the event the
    // moment its end_time passed — exactly when a queue is still at the door —
    // and anything past the first page was never found at all.
    fetch(`/api/events/${eventId}`)
      .then((r) => (r.ok ? (r.json() as Promise<Event>) : Promise.reject(new Error("Failed to load event"))))
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [allowed, eventId]);

  const handleExit = useCallback(() => router.push(`/staff/events/${eventId}`), [router, eventId]);

  if (pending) return <KioskSpinner />;
  // The guard is already redirecting; rendering nothing beats a spinner that
  // would never resolve, since the fetch above never runs for a denied user.
  if (!allowed) return null;
  if (loading) return <KioskSpinner />;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <KioskBar eventTitle={event?.title} onExit={handleExit} />

      <div className="flex min-h-0 flex-1">
        {!event ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <p className="text-sm text-muted-fg">Event not found or unavailable.</p>
          </div>
        ) : (
          <KioskScannerView event={event} />
        )}
      </div>
    </div>
  );
}

function KioskSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
    </div>
  );
}
