"use client";

import { useCallback, useState } from "react";
import { EventForm, toFormValues, type EventPayload, type EventFormValues } from "./event-form";

interface EditEventFormProps {
  eventId: string;
  /** An EVENT row. Widened through `toFormValues`, so extra keys are ignored. */
  initialData: Partial<Record<keyof EventFormValues, unknown>>;
  /** The saved row, so the hero above the form reflects the edit without a refetch. */
  onSaved?: (event: Record<string, unknown>) => void;
}

/**
 * Saving stays on the page. It used to `router.push` to wherever it came from,
 * which was a redirect back to the same URL once the form moved into the event
 * page — a navigation whose only visible effect was losing your place.
 */
export function EditEventForm({ eventId, initialData, onSaved }: EditEventFormProps) {
  const [saved, setSaved] = useState(false);

  // Passed to EventForm as an effect dependency, so it has to keep its identity
  // across renders or the dirty-change effect would loop.
  const handleDirtyChange = useCallback((dirty: boolean) => {
    if (dirty) setSaved(false);
  }, []);

  async function saveEvent(payload: EventPayload) {
    // The meeting link is not this form's to write once the event exists: the
    // Overview panel owns it, and every staff role that can open the event can
    // reach that one. Sending the value this form was seeded with would let a
    // save here silently revert a link a facilitator posted in the meantime.
    // Turning the event back to onsite still clears it, in `updateEvent`.
    const body: Partial<EventPayload> = { ...payload };
    delete body.meeting_url;

    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to update event");
    }

    onSaved?.(await res.json());
    setSaved(true);
  }

  return (
    <EventForm
      mode="edit"
      submitLabel="Save changes"
      submittingLabel="Saving..."
      statusMessage={saved ? "Changes saved." : null}
      initialValues={toFormValues(initialData)}
      onDirtyChange={handleDirtyChange}
      onSubmit={saveEvent}
    />
  );
}
