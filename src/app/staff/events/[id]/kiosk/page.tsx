"use client";

import { ROLES } from "@/shared/lib/roles";
import { useParams } from "next/navigation";
import { KioskScannerView } from "@/modules/kiosk/components/kiosk-scanner-view";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import type { Event } from "@/shared/types";

export default function StaffEventKioskPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { pending, allowed } = useRoleGuard(ROLES.FACILITATOR);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/events?filter=upcoming")
      .then((r) => (r.ok ? r.json() : Promise.reject("Failed to load event")))
      .then((data) => {
        const rows = (data as { data?: Event[] }).data ?? [];
        const found = rows.find((e: Event) => String(e.id) === eventId);
        setEvent(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [allowed, eventId]);

  if (pending || loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
      </div>
    );
  }

  if (!allowed) return null;

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

      <div className="flex flex-1">
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
