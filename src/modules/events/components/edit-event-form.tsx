"use client";

import { useRouter } from "next/navigation";
import { EventForm, toFormValues, type EventPayload, type EventFormValues } from "./event-form";

interface EditEventFormProps {
  eventId: string;
  /** An EVENT row. Widened through `toFormValues`, so extra keys are ignored. */
  initialData: Partial<Record<keyof EventFormValues, unknown>>;
  /** Where the back link goes and where the form lands after a save. */
  backHref?: string;
}

export function EditEventForm({ eventId, initialData, backHref }: EditEventFormProps) {
  const router = useRouter();
  // The standalone /staff/events/[id]/edit route keeps the public-event target;
  // the staff detail page passes its own URL so an admin never bounces through
  // the attendee-view redirect at /events/[id].
  const target = backHref ?? `/events/${eventId}`;

  async function saveEvent(payload: EventPayload) {
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update event");

    router.push(target);
  }

  return (
    <>
      <EventForm
        heading="Edit Event"
        backHref={target}
        backLabel="Back to Event"
        submitLabel="Save Changes"
        submittingLabel="Saving..."
        initialValues={toFormValues(initialData)}
        onSubmit={saveEvent}
      />
    </>
  );
}
