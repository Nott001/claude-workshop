"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/shared/components/toast";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { EventForm, type EventPayload } from "@/modules/events/components/event-form";

export default function StaffNewEventPage() {
  const router = useRouter();
  const { allowed, pending } = useRoleGuard("admin");
  const [showToast, setShowToast] = useState(false);

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

  if (pending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading...</div>
      </div>
    );
  }

  if (!allowed) return null;

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
