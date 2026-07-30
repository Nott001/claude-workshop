"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { EditEventForm } from "@/modules/events/components/edit-event-form";
import { useEffect, useState } from "react";

export default function StaffEditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const userRole = user?.role ?? null;
  const eventId = params.id as string;
  const [initialData, setInitialData] = useState<{
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
  } | null>(null);

  useEffect(() => {
    if (!hasMinRole(userRole, "facilitator")) {
      router.replace("/staff/events");
    }
  }, [userRole, router]);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setInitialData(data))
      .catch(() => router.replace("/staff/events"));
  }, [eventId, router]);

  if (!hasMinRole(userRole, "facilitator")) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <EditEventForm eventId={eventId} initialData={initialData} />;
}
