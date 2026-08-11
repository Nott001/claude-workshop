"use client";

import { MultiSelectDropdown, type MultiSelectOption } from "@/shared/components/multi-select";
import type { EventFormValues } from "@/modules/events/lib/event-form-schema";

const FIELD_CLASS = "w-full rounded-lg border border-border px-3 py-2 text-sm";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-fg";

interface EventFormFieldsProps {
  values: EventFormValues;
  set: <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void;
  facilitatorOptions: MultiSelectOption[];
  speakerOptions: MultiSelectOption[];
  facilitatorsError: boolean;
  speakersError: boolean;
}

export function EventFormFields({
  values,
  set,
  facilitatorOptions,
  speakerOptions,
  facilitatorsError,
  speakersError,
}: EventFormFieldsProps) {
  return (
    <>
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

      <MultiSelectDropdown
        label="Facilitators"
        options={facilitatorOptions}
        selectedIds={values.facilitator_ids}
        onChange={(ids) => set("facilitator_ids", ids)}
        placeholder="Select facilitators..."
        emptyLabel={facilitatorsError ? "Failed to load facilitators." : "No facilitators available."}
      />

      <MultiSelectDropdown
        label="Speakers"
        options={speakerOptions}
        selectedIds={values.speaker_profile_ids}
        onChange={(ids) => set("speaker_profile_ids", ids)}
        placeholder="Select speakers..."
        emptyLabel={speakersError ? "Failed to load speakers." : "No speakers available."}
      />

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
    </>
  );
}
