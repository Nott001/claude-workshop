"use client";

import { useRouter } from "next/navigation";
import { EventForm, toFormValues, type EventPayload, type EventFormValues } from "./event-form";

interface EditEventFormProps {
  eventId: string;
  /** An EVENT row. Widened through `toFormValues`, so extra keys are ignored. */
  initialData: Partial<Record<keyof EventFormValues, unknown>>;
}

export function EditEventForm({ eventId, initialData }: EditEventFormProps) {
  const router = useRouter();

  async function saveEvent(payload: EventPayload) {
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update event");

    router.push(`/events/${eventId}`);
  }

  return (
    <>
      <EventForm
        heading="Edit Event"
        backHref={`/events/${eventId}`}
        backLabel="Back to Event"
        submitLabel="Save Changes"
        submittingLabel="Saving..."
        initialValues={toFormValues(initialData)}
        onSubmit={saveEvent}
      />
    </>
  );
}
