"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/shared/lib/roles";
import { Toast } from "@/shared/components/toast";
import { BackLink } from "@/shared/components/back-link";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { EventForm, type EventPayload } from "@/modules/events/components/event-form";

/**
 * Creating an event. Editing one lives on the event's own page, under Details —
 * there is no separate edit route, because an editor that cannot show you the
 * event it is editing is a worse editor.
 *
 * The page frame is here rather than in `EventForm`: the form is also rendered
 * inside a panel, where a second frame would be a page within a page.
 */
export function EventFormPage() {
  const router = useRouter();
  const { allowed, pending } = useRoleGuard(ROLES.ADMIN);
  const [showToast, setShowToast] = useState(false);

  if (pending) {
    return <StaffPageState>Loading...</StaffPageState>;
  }

  if (!allowed) return null;

  async function createEvent(payload: EventPayload) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create event");

    const created = await res.json().catch(() => null);
    setShowToast(true);
    // Straight to the new event, so staffing and publishing carry on where the
    // rest of its settings already are.
    setTimeout(() => router.push(created?.id ? `/staff/events/${created.id}` : "/staff/events"), 1200);
  }

  return (
    <StaffPage>
      <BackLink href="/staff/events" className="mb-6">
        Back to Events
      </BackLink>

      <StaffPageHeader title="Create Event" description="Publish it once the details are set." />

      <EventForm includeTeam submitLabel="Create Event" submittingLabel="Creating..." onSubmit={createEvent} />

      {showToast && (
        <div className="fixed right-4 bottom-4 z-50">
          <Toast title="Event created successfully!" />
        </div>
      )}
    </StaffPage>
  );
}
