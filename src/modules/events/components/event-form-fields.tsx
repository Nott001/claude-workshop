"use client";

import { SectionCard } from "@/shared/components/section-card";
import { FormField, FormLabel, FormDescription } from "@/shared/components/form";
import { Input } from "@/shared/components/input";
import { cn } from "@/shared/lib/utils";
import type { EventFormValues } from "@/modules/events/lib/event-form-schema";

export type EventFieldSetter = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void;

const OPTIONAL = <span className="font-normal text-muted-fg">(optional)</span>;

/** The EVENT columns themselves. Who staffs the event is assigned separately —
 *  see `EventTeamFields` for creation and `EventTeamPanel` for an existing row. */
export function EventFormFields({ values, set }: { values: EventFormValues; set: EventFieldSetter }) {
  return (
    <>
      <SectionCard title="Event Basics" icon="event">
        <div className="space-y-4">
          <FormField>
            <FormLabel htmlFor="event-title">Title</FormLabel>
            <Input
              id="event-title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              required
              maxLength={255}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField>
              <FormLabel htmlFor="event-date">Date</FormLabel>
              <Input
                id="event-date"
                type="date"
                value={values.event_date}
                onChange={(e) => set("event_date", e.target.value)}
                required
              />
            </FormField>
            <FormField>
              <FormLabel htmlFor="event-start-time">Start Time</FormLabel>
              <Input
                id="event-start-time"
                type="time"
                value={values.start_time}
                onChange={(e) => set("start_time", e.target.value)}
                required
              />
            </FormField>
            <FormField>
              <FormLabel htmlFor="event-end-time">End Time</FormLabel>
              <Input
                id="event-end-time"
                type="time"
                value={values.end_time}
                onChange={(e) => set("end_time", e.target.value)}
                required
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField>
              <FormLabel htmlFor="event-venue-name">Venue</FormLabel>
              <Input
                id="event-venue-name"
                value={values.venue_name}
                onChange={(e) => set("venue_name", e.target.value)}
                required
                maxLength={255}
              />
            </FormField>
            <FormField>
              <FormLabel htmlFor="event-venue-address">Venue address {OPTIONAL}</FormLabel>
              <Input
                id="event-venue-address"
                value={values.venue_address}
                onChange={(e) => set("venue_address", e.target.value)}
              />
            </FormField>
          </div>

          <FormField>
            <FormLabel htmlFor="event-description">Event description {OPTIONAL}</FormLabel>
            <textarea
              id="event-description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              className={cn(
                "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg transition-colors outline-none",
                "placeholder:text-muted-fg focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title="Pricing" icon="payments">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField className="sm:col-span-2">
            <FormLabel htmlFor="event-price">Price</FormLabel>
            <Input
              id="event-price"
              type="number"
              min="0"
              step="0.01"
              value={values.price}
              onChange={(e) => set("price", e.target.value)}
            />
            <FormDescription className="text-xs">Leave at 0 for a free event.</FormDescription>
          </FormField>
          <FormField>
            <FormLabel htmlFor="event-currency">Currency</FormLabel>
            <Input
              id="event-currency"
              value={values.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              required
              maxLength={3}
              pattern="[A-Za-z]{3}"
              title="Three-letter currency code, e.g. PHP"
            />
          </FormField>
        </div>
      </SectionCard>
    </>
  );
}
