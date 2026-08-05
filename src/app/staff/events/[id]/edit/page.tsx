"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { EditEventForm } from "@/modules/events/components/edit-event-form";

export default function StaffEditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { allowed, pending } = useRoleGuard("facilitator");
  const eventId = params.id as string;
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setInitialData(data))
      .catch(() => router.replace("/staff/events"));
  }, [eventId, router]);

  if (pending || !initialData) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return <EditEventForm eventId={eventId} initialData={initialData} />;
}
