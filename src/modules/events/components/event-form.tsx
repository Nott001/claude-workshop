"use client";

import { useEffect, useState } from "react";
import { EventFormFields } from "@/modules/events/components/event-form-fields";
import { EventTeamFields } from "@/modules/events/components/event-team-fields";
import { Button } from "@/shared/components/button";
import {
  EMPTY_EVENT_FORM,
  toEventPayload,
  type EventFormValues,
  type EventPayload,
} from "@/modules/events/lib/event-form-schema";

// Re-exported so consumers that imported these from the form keep working.
export { EMPTY_EVENT_FORM, toFormValues, toEventPayload } from "@/modules/events/lib/event-form-schema";
export type { EventFormValues, EventPayload } from "@/modules/events/lib/event-form-schema";

interface EventFormProps {
  submitLabel: string;
  submittingLabel: string;
  initialValues?: EventFormValues;
  /** Creation only — see `EventTeamFields` for why an existing event differs. */
  includeTeam?: boolean;
  /**
   * Editing an existing row: offers Discard, and holds Save until something has
   * actually changed. A create form has nothing to discard back to.
   */
  editing?: boolean;
  /** Shown beside the submit button, e.g. "Changes saved." */
  statusMessage?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (payload: EventPayload) => Promise<void>;
}

/**
 * The event fields and nothing else — no page frame, no heading, no back link.
 *
 * It used to carry all three, which was invisible on `/staff/events/new` where
 * it *was* the page, and wrong everywhere else: dropped into a panel on the
 * staff detail page it rendered a second page inside the first, complete with
 * its own "Back to Event" link. Page chrome is the route's job now.
 */
export function EventForm({
  submitLabel,
  submittingLabel,
  initialValues = EMPTY_EVENT_FORM,
  includeTeam = false,
  editing = false,
  statusMessage,
  onDirtyChange,
  onSubmit,
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  // What is currently stored, as this form understands it. Held here rather
  // than re-read from `initialValues` because the server echoes columns back in
  // its own spelling — a `time` comes back as "09:00:00" against the "09:00" an
  // <input type="time"> holds — which would leave a just-saved form dirty.
  const [baseline, setBaseline] = useState<EventFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const set: <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // eventSchema refines the same rule and the DB enforces chk_event_time, but
    // both surface as a flat 400 the form can only report as "failed". Checking
    // here is what turns it into something the user can act on.
    if (values.start_time >= values.end_time) {
      setError("End time must be after start time.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(toEventPayload(values));
      setBaseline(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <EventFormFields values={values} set={set} />
      {includeTeam && <EventTeamFields values={values} set={set} />}

      {/* Sticky, because the fields are taller than a viewport and a save
          button at the bottom of them is a scroll away from most of the edits
          it commits. */}
      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-bg/90 px-6 py-4 backdrop-blur">
        {error && (
          <p role="alert" className="mr-auto text-sm text-error">
            {error}
          </p>
        )}
        {!error && statusMessage && <p className="mr-auto text-sm text-success">{statusMessage}</p>}

        {editing && dirty && (
          <Button type="button" variant="secondary" size="lg" onClick={() => setValues(baseline)} disabled={submitting}>
            Discard changes
          </Button>
        )}
        <Button type="submit" size="lg" disabled={submitting || (editing && !dirty)}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
