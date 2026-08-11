"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type MultiSelectOption } from "@/shared/components/multi-select";
import { EventFormFields } from "@/modules/events/components/event-form-fields";
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
  heading: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: EventFormValues;
  onSubmit: (payload: EventPayload) => Promise<void>;
}

interface FacilitatorCandidate {
  id: number;
  full_name: string;
  email: string;
}

interface SpeakerCandidate {
  id: number;
  user_id: number;
  designation: string | null;
  USER: { full_name: string; email: string } | null;
}

export function EventForm({
  heading,
  backHref,
  backLabel,
  submitLabel,
  submittingLabel,
  initialValues = EMPTY_EVENT_FORM,
  onSubmit,
}: EventFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilitators, setFacilitators] = useState<FacilitatorCandidate[]>([]);
  const [facilitatorsError, setFacilitatorsError] = useState(false);
  const [speakers, setSpeakers] = useState<SpeakerCandidate[]>([]);
  const [speakersError, setSpeakersError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [facRes, spkRes] = await Promise.all([fetch("/api/facilitators"), fetch("/api/speakers?role=speaker&limit=100")]);
      if (cancelled) return;

      if (facRes.ok) {
        const rows: FacilitatorCandidate[] = await facRes.json();
        if (!cancelled) setFacilitators(rows);
      } else {
        setFacilitatorsError(true);
      }

      if (spkRes.ok) {
        const data = (await spkRes.json()) as { data?: SpeakerCandidate[] };
        const rows: SpeakerCandidate[] = data.data ?? [];
        if (!cancelled) setSpeakers(rows);
      } else {
        setSpeakersError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const facilitatorOptions: MultiSelectOption[] = facilitators.map((f) => ({
    id: f.id,
    label: f.full_name,
    sublabel: f.email,
  }));

  const speakerOptions: MultiSelectOption[] = speakers.map((s) => ({
    id: s.id,
    label: s.USER?.full_name ?? `User #${s.user_id}`,
    sublabel: s.designation ?? s.USER?.email ?? undefined,
  }));

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-bg px-5 py-12 sm:px-8 md:px-12">
      <div className="mx-auto w-full max-w-[896px]">
        <button
          onClick={() => router.push(backHref)}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="material-symbols-rounded text-[16px]">arrow_back</span>
          {backLabel}
        </button>

        <h1 className="mb-8 text-[36px] leading-[40px] font-bold tracking-[-0.02em] text-fg">{heading}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <EventFormFields
            values={values}
            set={set}
            facilitatorOptions={facilitatorOptions}
            speakerOptions={speakerOptions}
            facilitatorsError={facilitatorsError}
            speakersError={speakersError}
          />

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
          >
            {submitting ? submittingLabel : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
