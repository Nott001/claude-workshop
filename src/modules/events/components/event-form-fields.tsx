"use client";

import { SectionCard } from "@/shared/components/section-card";
import { FormField, FormLabel, FormDescription } from "@/shared/components/form";
import { Input } from "@/shared/components/input";
import { Button } from "@/shared/components/button";
import { cn } from "@/shared/lib/utils";
import { PRICE_STEP, stepPrice, type EventFormValues } from "@/modules/events/lib/event-form-schema";

export type EventFieldSetter = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void;

const OPTIONAL = <span className="font-normal text-muted-fg">(optional)</span>;

const MODES = [
  { value: "onsite", label: "Onsite", icon: "location_on" },
  { value: "online", label: "Online", icon: "videocam" },
] as const;

/** The EVENT columns themselves. Who staffs the event is assigned separately —
 *  see `EventTeamFields` for creation and `EventTeamPanel` for an existing row. */
export function EventFormFields({
  values,
  set,
  creating = false,
}: {
  values: EventFormValues;
  set: EventFieldSetter;
  /** An event that does not exist yet has nowhere else to put its meeting link. */
  creating?: boolean;
}) {
  const online = values.event_type === "online";

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

          {/* Radios rather than a select: two mutually exclusive choices, both
              worth seeing at once, and the answer changes what the fields under
              it mean. A fieldset so the pair is announced as one question. */}
          <fieldset>
            <legend className="text-sm leading-none font-medium select-none">Where it happens</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    values.event_type === mode.value
                      ? "border-brand bg-brand/5 font-medium text-fg"
                      : "border-border bg-surface text-muted-fg hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="event-type"
                    value={mode.value}
                    checked={values.event_type === mode.value}
                    onChange={() => set("event_type", mode.value)}
                    className="sr-only"
                  />
                  <span aria-hidden className="material-symbols-rounded text-base">
                    {mode.icon}
                  </span>
                  {mode.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField>
              {/* One column, two meanings. An online event still has to name
                  where it happens, and venue_name is NOT NULL — it holds the
                  platform instead of the hall. */}
              <FormLabel htmlFor="event-venue-name">{online ? "Platform" : "Venue"}</FormLabel>
              <Input
                id="event-venue-name"
                value={values.venue_name}
                onChange={(e) => set("venue_name", e.target.value)}
                required
                maxLength={255}
                placeholder={online ? "Zoom, Google Meet, ..." : undefined}
              />
            </FormField>
            {/* The same column asks a different question per mode, rather than
                showing a dead address box next to a live link box. Distinct ids
                so a browser never carries one field's value into the other.

                The link is editable here only while the event is being created,
                for the same reason the cover and the team are: there is no row
                yet to hang a dedicated panel off. Once one exists the Overview
                panel owns it — one surface per context, and that one is
                reachable by the facilitator running the session, who cannot
                open this form at all. */}
            {!online ? (
              <FormField>
                <FormLabel htmlFor="event-venue-address">Venue address {OPTIONAL}</FormLabel>
                <Input
                  id="event-venue-address"
                  value={values.venue_address}
                  onChange={(e) => set("venue_address", e.target.value)}
                />
              </FormField>
            ) : creating ? (
              <FormField>
                <FormLabel htmlFor="event-meeting-url">Meeting link {OPTIONAL}</FormLabel>
                <Input
                  id="event-meeting-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://meet.google.com/..."
                  value={values.meeting_url}
                  onChange={(e) => set("meeting_url", e.target.value)}
                />
                <FormDescription className="text-xs">
                  Can be added later, and stays hidden from attendees until the event starts.
                </FormDescription>
              </FormField>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm leading-none font-medium">Meeting link</p>
                <FormDescription className="text-xs">
                  Set on the Overview tab, so whoever is running the session can post it on the day.
                </FormDescription>
              </div>
            )}
          </div>

          {/* Both gaps are spelled out rather than left to the shared
              `space-y-1.5`, because they want different sizes: the label
              carries a second phrase — the "(optional)" — which sat almost on
              the box, while the note below belongs close to the control it
              explains. A `<label>` is inline by default, so `block` is what
              makes its margin apply at all. */}
          <FormField className="space-y-0">
            <FormLabel htmlFor="event-capacity" className="mb-3.5 block">
              Capacity {OPTIONAL}
            </FormLabel>
            <Input
              id="event-capacity"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="Unlimited"
              className="sm:max-w-48"
              value={values.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
            <FormDescription className="mt-2 text-xs">
              Registration closes once this many seats are taken. Leave it empty for unlimited seats.
            </FormDescription>
          </FormField>

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
            <div className="flex items-center gap-2">
              <Input
                id="event-price"
                type="number"
                min="0"
                // `any` rather than the amount the buttons move by: a step of 100
                // makes the browser reject every price that is not a multiple of
                // it, and 1500.50 is a price this column stores. The native arrows
                // are hidden here, so the increment lives on the buttons alone.
                step="any"
                inputMode="decimal"
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
              />
              {/* Both steppers sit to the right of the box, where the native
                  arrows they replace used to be. */}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={`Decrease price by ${PRICE_STEP}`}
                onClick={() => set("price", stepPrice(values.price, -PRICE_STEP))}
              >
                <span aria-hidden className="material-symbols-rounded text-base">
                  remove
                </span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={`Increase price by ${PRICE_STEP}`}
                onClick={() => set("price", stepPrice(values.price, PRICE_STEP))}
              >
                <span aria-hidden className="material-symbols-rounded text-base">
                  add
                </span>
              </Button>
            </div>
            <FormDescription className="text-xs">
              Leave at 0 for a free event. The buttons move it by {PRICE_STEP}; any amount can still be typed.
            </FormDescription>
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
