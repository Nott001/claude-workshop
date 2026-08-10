"use client";

import { ROLES } from "@/shared/lib/roles";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Toast } from "@/shared/components/toast";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { EventForm, type EventPayload } from "@/modules/events/components/event-form";
import { EditEventForm } from "@/modules/events/components/edit-event-form";

export function EventFormPage({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const params = useParams();
  const isEdit = mode === "edit";
  const eventId = isEdit ? (params.id as string) : "";
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(isEdit ? null : {});
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setInitialData(data))
      .catch(() => router.replace("/staff/events"));
  }, [isEdit, eventId, router]);

  if (pending || (isEdit && !initialData)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

  async function createEvent(payload: EventPayload) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create event");

    setShowToast(true);
    setTimeout(() => router.push("/staff/events"), 1500);
  }

  if (isEdit) {
    return initialData ? <EditEventForm eventId={eventId} initialData={initialData} /> : null;
  }

  return (
    <>
      <EventForm
        heading="Create Event"
        backHref="/staff/events"
        backLabel="Back to Events"
        submitLabel="Create Event"
        submittingLabel="Creating..."
        onSubmit={createEvent}
      />

      {showToast && (
        <div className="fixed right-4 bottom-4 z-50">
          <Toast title="Event created successfully!" />
        </div>
      )}
    </>
  );
}
