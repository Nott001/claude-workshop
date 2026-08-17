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
  facilitator_ids: number[];
  speaker_profile_ids: number[];
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
  facilitator_ids: [],
  speaker_profile_ids: [],
};

/**
 * Widen an EVENT row into form values. Every field is a string because that is
 * what an <input> holds; `toEventPayload` converts back on submit.
 */
export function toFormValues(event: Partial<Record<keyof EventFormValues, unknown>>): EventFormValues {
  const text = (value: unknown, fallback = "") => (value === null || value === undefined ? fallback : String(value));
  // Postgres hands a `time` column back as "09:00:00"; an <input type="time">
  // holds "09:00". Trimming here keeps a form seeded from a stored row equal to
  // the same form after a round-trip through the browser.
  const time = (value: unknown) => text(value).slice(0, 5);

  return {
    title: text(event.title),
    event_date: text(event.event_date),
    start_time: time(event.start_time),
    end_time: time(event.end_time),
    venue_name: text(event.venue_name),
    venue_address: text(event.venue_address),
    description: text(event.description),
    price: text(event.price, "0"),
    currency: text(event.currency, "PHP"),
    facilitator_ids: Array.isArray(event.facilitator_ids) ? event.facilitator_ids : [],
    speaker_profile_ids: Array.isArray(event.speaker_profile_ids) ? event.speaker_profile_ids : [],
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
    facilitator_ids: values.facilitator_ids,
    speaker_profile_ids: values.speaker_profile_ids,
  };
}

export type EventPayload = ReturnType<typeof toEventPayload>;
