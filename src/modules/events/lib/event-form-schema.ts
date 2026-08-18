import type { EventMode } from "@/shared/types";

export interface EventFormValues {
  title: string;
  /** Onsite events have an address; online ones name a platform in `venue_name`. */
  event_type: EventMode;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string;
  /** Only an online event has one, and it is usually added long after creation. */
  meeting_url: string;
  description: string;
  price: string;
  currency: string;
  /** Empty means uncapped — the same thing a null `capacity` column means. */
  capacity: string;
  facilitator_ids: number[];
  speaker_profile_ids: number[];
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: "",
  event_type: "onsite",
  event_date: "",
  start_time: "",
  end_time: "",
  venue_name: "",
  venue_address: "",
  meeting_url: "",
  description: "",
  price: "0",
  currency: "PHP",
  capacity: "",
  facilitator_ids: [],
  speaker_profile_ids: [],
};

/**
 * How much one press of the price stepper moves the price.
 *
 * Tickets here are priced in the hundreds, and the number input's native arrows
 * stepped by the 0.01 its `step` attribute declared — the column's own
 * precision, which is the wrong thing for an arrow to move by. Crossing a
 * realistic ticket price that way takes tens of thousands of presses.
 */
export const PRICE_STEP = 100;

/**
 * The price after one press of the stepper, as the string the input holds.
 *
 * Clamped at zero, because a negative price is refused by `eventSchema` and by
 * the database's `chk_event_price_nonneg` alike, and rounded to the two decimals
 * the column stores so stepping away from a typed 1500.50 does not accumulate
 * binary-float dust. A blank or unparseable box counts as zero rather than
 * yielding NaN.
 */
export function stepPrice(current: string, delta: number): string {
  const parsed = Number(current.trim());
  const base = Number.isFinite(parsed) ? parsed : 0;
  return String(Math.max(0, Math.round((base + delta) * 100) / 100));
}

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
    // Anything the column cannot hold reads as onsite, which is the same
    // default the database gives a row that predates the column.
    event_type: event.event_type === "online" ? "online" : "onsite",
    event_date: text(event.event_date),
    start_time: time(event.start_time),
    end_time: time(event.end_time),
    venue_name: text(event.venue_name),
    venue_address: text(event.venue_address),
    meeting_url: text(event.meeting_url),
    description: text(event.description),
    price: text(event.price, "0"),
    currency: text(event.currency, "PHP"),
    capacity: text(event.capacity),
    facilitator_ids: Array.isArray(event.facilitator_ids) ? event.facilitator_ids : [],
    speaker_profile_ids: Array.isArray(event.speaker_profile_ids) ? event.speaker_profile_ids : [],
  };
}

/** Narrow form values back to the shape `eventSchema` validates. */
export function toEventPayload(values: EventFormValues) {
  const online = values.event_type === "online";

  return {
    title: values.title.trim(),
    event_type: values.event_type,
    event_date: values.event_date,
    start_time: values.start_time,
    end_time: values.end_time,
    venue_name: values.venue_name.trim(),
    // The columns are nullable; an untouched input is "", which is not the same
    // thing and would store an empty string where the app checks for null.
    //
    // An online event sends null whatever the box still holds: the input is
    // disabled rather than emptied, so its old address survives a switch to
    // online and would otherwise ride along into the ticket and the calendar
    // invite. The database refuses the pair outright.
    venue_address: online ? null : values.venue_address.trim() || null,
    // The mirror of the line above, and of chk_event_meeting_url_online_only:
    // an onsite event carries no link, so switching back clears it rather than
    // leaving a live meeting URL on a row nothing renders it from.
    meeting_url: online ? values.meeting_url.trim() || null : null,
    description: values.description.trim() || null,
    price: values.price.trim() === "" ? 0 : Number(values.price),
    currency: values.currency.trim().toUpperCase() || "PHP",
    // A cleared capacity is an explicit null rather than an omission, so
    // removing the cap on an existing event actually clears the column — a
    // PATCH that simply leaves the key out would keep the old cap.
    capacity: values.capacity.trim() === "" ? null : Number(values.capacity),
    facilitator_ids: values.facilitator_ids,
    speaker_profile_ids: values.speaker_profile_ids,
  };
}

export type EventPayload = ReturnType<typeof toEventPayload>;
