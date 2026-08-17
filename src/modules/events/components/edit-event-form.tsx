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
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message ?? "Failed to update event");
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
