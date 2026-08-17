"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventFormFields } from "@/modules/events/components/event-form-fields";
import { EventTeamFields } from "@/modules/events/components/event-team-fields";
import { CoverImagePicker } from "@/modules/events/components/cover-image-picker";
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

/**
 * Which event this form is for: one that does not exist yet, or one that does.
 *
 * A single word rather than the three independent booleans this used to take
 * (`includeTeam`, `includeCover`, `editing`), because they were never
 * independent — an event with no row has no id to assign a facilitator against
 * and nowhere to store a cover, and nothing to discard back to. Three flags
 * spelled eight combinations of which two were real, and each caller had to
 * remember which.
 */
export type EventFormMode = "create" | "edit";

interface EventFormProps {
  mode: EventFormMode;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: EventFormValues;
  /** Shown beside the submit button, e.g. "Changes saved." */
  statusMessage?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  /** `coverFile` is what the create form staged, and always null in edit mode. */
  onSubmit: (payload: EventPayload, coverFile: File | null) => Promise<void>;
}

/**
 * The event sections and nothing else — no page frame, no heading, no back link.
 *
 * It used to carry all three, which was invisible on `/staff/events/new` where
 * it *was* the page, and wrong everywhere else: dropped into a panel on the
 * staff detail page it rendered a second page inside the first, complete with
 * its own "Back to Event" link. Page chrome is the route's job now.
 *
 * The sections run cover, basics, pricing, team in both modes — the same order
 * the event's own Details tab reads in, so creating an event and editing one
 * are the same page with the same landmarks rather than two arrangements of the
 * same fields.
 */
export function EventForm({
  mode,
  submitLabel,
  submittingLabel,
  initialValues = EMPTY_EVENT_FORM,
  statusMessage,
  onDirtyChange,
  onSubmit,
}: EventFormProps) {
  const creating = mode === "create";

  const [values, setValues] = useState<EventFormValues>(initialValues);
  // What is currently stored, as this form understands it. Held here rather
  // than re-read from `initialValues` because the server echoes columns back in
  // its own spelling — a `time` comes back as "09:00:00" against the "09:00" an
  // <input type="time"> holds — which would leave a just-saved form dirty.
  const [baseline, setBaseline] = useState<EventFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Outside `values` because the dirty check compares them as JSON, and a File
  // serializes to `{}` — every picked cover would read as no change at all.
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Serializing the whole form is the cheap way to compare it and the wasteful
  // way to answer "did the submit button just change state": memoized so
  // picking a cover, failing a save or starting one does not re-run it.
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Stable, so the sections below can skip a render they have no stake in.
  const set = useCallback(<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

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
      await onSubmit(toEventPayload(values), coverFile);
      setBaseline(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Creation only: the picked file reaches `onSubmit` rather than storage,
          because a cover's object path needs the event id. An event that has
          one uploads on pick, from `CoverImageUpload` on its Details tab. */}
      {creating && <CoverImagePicker onChange={setCoverFile} />}

      <EventFormFields values={values} set={set} />

      {creating && (
        <EventTeamFields facilitatorIds={values.facilitator_ids} speakerProfileIds={values.speaker_profile_ids} set={set} />
      )}

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

        {!creating && dirty && (
          <Button type="button" variant="secondary" size="lg" onClick={() => setValues(baseline)} disabled={submitting}>
            Discard changes
          </Button>
        )}
        <Button type="submit" size="lg" disabled={submitting || (!creating && !dirty)}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
