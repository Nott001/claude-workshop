"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EventFormValues {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string;
  description: string;
  price: string;
  currency: string;
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: "",
  event_date: "",
  start_time: "",
  end_time: "",
  venue_name: "",
  venue_address: "",
  description: "",
  price: "0",
  currency: "PHP",
};

/**
 * Widen an EVENT row into form values. Every field is a string because that is
 * what an <input> holds; `toEventPayload` converts back on submit.
 */
export function toFormValues(event: Partial<Record<keyof EventFormValues, unknown>>): EventFormValues {
  const text = (value: unknown, fallback = "") => (value === null || value === undefined ? fallback : String(value));

  return {
    title: text(event.title),
    event_date: text(event.event_date),
    start_time: text(event.start_time),
    end_time: text(event.end_time),
    venue_name: text(event.venue_name),
    venue_address: text(event.venue_address),
    description: text(event.description),
    price: text(event.price, "0"),
    currency: text(event.currency, "PHP"),
  };
}

/** Narrow form values back to the shape `eventSchema` validates. */
export function toEventPayload(values: EventFormValues) {
  return {
    title: values.title.trim(),
    event_date: values.event_date,
    start_time: values.start_time,
    end_time: values.end_time,
    venue_name: values.venue_name.trim(),
    // The columns are nullable; an untouched input is "", which is not the same
    // thing and would store an empty string where the app checks for null.
    venue_address: values.venue_address.trim() || null,
    description: values.description.trim() || null,
    price: values.price.trim() === "" ? 0 : Number(values.price),
    currency: values.currency.trim().toUpperCase() || "PHP",
  };
}

export type EventPayload = ReturnType<typeof toEventPayload>;

const FIELD_CLASS = "w-full rounded-lg border border-border px-3 py-2 text-sm";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-fg";

interface EventFormProps {
  heading: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: EventFormValues;
  onSubmit: (payload: EventPayload) => Promise<void>;
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

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
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
          <div>
            <label htmlFor="event-title" className={LABEL_CLASS}>
              Title
            </label>
            <input
              id="event-title"
              type="text"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              required
              maxLength={255}
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="event-date" className={LABEL_CLASS}>
                Date
              </label>
              <input
                id="event-date"
                type="date"
                value={values.event_date}
                onChange={(e) => set("event_date", e.target.value)}
                required
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="event-start-time" className={LABEL_CLASS}>
                Start Time
              </label>
              <input
                id="event-start-time"
                type="time"
                value={values.start_time}
                onChange={(e) => set("start_time", e.target.value)}
                required
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="event-end-time" className={LABEL_CLASS}>
                End Time
              </label>
              <input
                id="event-end-time"
                type="time"
                value={values.end_time}
                onChange={(e) => set("end_time", e.target.value)}
                required
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-venue-name" className={LABEL_CLASS}>
              Venue
            </label>
            <input
              id="event-venue-name"
              type="text"
              value={values.venue_name}
              onChange={(e) => set("venue_name", e.target.value)}
              required
              maxLength={255}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="event-venue-address" className={LABEL_CLASS}>
              Venue address <span className="font-normal text-muted-fg">(optional)</span>
            </label>
            <input
              id="event-venue-address"
              type="text"
              value={values.venue_address}
              onChange={(e) => set("venue_address", e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="event-description" className={LABEL_CLASS}>
              Description <span className="font-normal text-muted-fg">(optional)</span>
            </label>
            <textarea
              id="event-description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label htmlFor="event-price" className={LABEL_CLASS}>
                Price
              </label>
              <input
                id="event-price"
                type="number"
                min="0"
                step="0.01"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
                className={FIELD_CLASS}
              />
              <p className="mt-1.5 text-xs text-muted-fg">Leave at 0 for a free event.</p>
            </div>
            <div>
              <label htmlFor="event-currency" className={LABEL_CLASS}>
                Currency
              </label>
              <input
                id="event-currency"
                type="text"
                value={values.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                required
                maxLength={3}
                pattern="[A-Za-z]{3}"
                title="Three-letter currency code, e.g. PHP"
                className={FIELD_CLASS}
              />
            </div>
          </div>

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
