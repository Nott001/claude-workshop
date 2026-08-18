"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/shared/lib/roles";
import { Toast } from "@/shared/components/toast";
import { BackLink } from "@/shared/components/back-link";
import { StaffPage, StaffPageHeader, StaffPageState } from "@/shared/components/staff-page";
import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { postUpload } from "@/shared/integrations/storage/upload-client";
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
  const [toast, setToast] = useState<{ title: string; description?: string; type: "success" | "error" } | null>(null);

  if (pending) {
    return <StaffPageState>Loading...</StaffPageState>;
  }

  if (!allowed) return null;

  async function createEvent(payload: EventPayload, coverFile: File | null) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create event");

    const created = await res.json().catch(() => null);

    // The cover is stored at `events/<id>/cover.<ext>`, so it can only be
    // uploaded once the row exists. A failure here is reported rather than
    // thrown: the event was created, and throwing would hand the form back to
    // someone who would reasonably submit it again.
    let coverError: string | null = null;
    if (coverFile && created?.id) {
      const result = await postUpload("event_images", "/api/upload/event-image", coverFile, {
        event_id: String(created.id),
      });
      if (!result.ok) coverError = result.error;
    }

    setToast(
      coverError
        ? { title: "Event created, but the cover image did not upload.", description: coverError, type: "error" }
        : { title: "Event created successfully!", type: "success" },
    );
    // Straight to the new event, so staffing and publishing carry on where the
    // rest of its settings already are — and where a failed cover can be
    // re-picked under Details.
    setTimeout(() => router.push(created?.id ? `/staff/events/${created.id}` : "/staff/events"), coverError ? 3000 : 1200);
  }

  return (
    <StaffPage>
      <BackLink href="/staff/events" className="mb-6">
        Back to Events
      </BackLink>

      <StaffPageHeader title="Create Event" description="Publish it once the details are set." />

      <EventForm mode="create" submitLabel="Create Event" submittingLabel="Creating..." onSubmit={createEvent} />

      {toast && (
        <div className="fixed right-4 bottom-4 z-50">
          <Toast title={toast.title} description={toast.description} type={toast.type} />
        </div>
      )}
    </StaffPage>
  );
}
