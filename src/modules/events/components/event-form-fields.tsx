"use client";

import { AssignmentTable, type AssignmentRow } from "@/modules/events/components/assignment-table";
import type { EventFormValues } from "@/modules/events/lib/event-form-schema";

const FIELD_CLASS = "w-full rounded-lg border border-border px-3 py-2 text-sm";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-fg";

interface FormSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
      <div className="mb-5 flex items-center gap-2.5 border-b border-border pb-3">
        <div className="rounded-lg bg-info/10 p-2">
          <span className="material-symbols-rounded text-[20px] text-brand">{icon}</span>
        </div>
        <h2 className="text-xs font-bold tracking-[0.1em] text-fg">{title.toUpperCase()}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface EventFormFieldsProps {
  values: EventFormValues;
  set: <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void;
  facilitatorCandidates: AssignmentRow[];
  speakerCandidates: AssignmentRow[];
  facilitatorsError: boolean;
  speakersError: boolean;
  selectedFacilitatorId: string;
  setSelectedFacilitatorId: (id: string) => void;
  selectedSpeakerId: string;
  setSelectedSpeakerId: (id: string) => void;
  onAddFacilitator: () => void;
  onAddSpeaker: () => void;
}

export function EventFormFields({
  values,
  set,
  facilitatorCandidates,
  speakerCandidates,
  facilitatorsError,
  speakersError,
  selectedFacilitatorId,
  setSelectedFacilitatorId,
  selectedSpeakerId,
  setSelectedSpeakerId,
  onAddFacilitator,
  onAddSpeaker,
}: EventFormFieldsProps) {
  const assignedFacilitators = facilitatorCandidates.filter((c) => values.facilitator_ids.includes(c.id));
  const availableFacilitators = facilitatorCandidates.filter((c) => !values.facilitator_ids.includes(c.id));
  const assignedSpeakers = speakerCandidates.filter((c) => values.speaker_profile_ids.includes(c.id));
  const availableSpeakers = speakerCandidates.filter((c) => !values.speaker_profile_ids.includes(c.id));

  return (
    <>
      <FormSection title="Event Basics" icon="event">
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
      </FormSection>

      <FormSection title="Description" icon="notes">
        <div>
          <label htmlFor="event-description" className={LABEL_CLASS}>
            Event description <span className="font-normal text-muted-fg">(optional)</span>
          </label>
          <textarea
            id="event-description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className={FIELD_CLASS}
          />
        </div>
      </FormSection>

      <FormSection title="Team" icon="groups">
        <div>
          <p className="mb-3 text-sm font-semibold text-fg">Facilitators</p>
          <AssignmentTable
            assigned={assignedFacilitators}
            candidates={availableFacilitators}
            selectedId={selectedFacilitatorId}
            onSelect={setSelectedFacilitatorId}
            onAdd={onAddFacilitator}
            onRemove={(id) =>
              set(
                "facilitator_ids",
                values.facilitator_ids.filter((fid) => fid !== id),
              )
            }
            addButtonLabel="Assign"
            candidatePlaceholder="Select a facilitator..."
            emptyLabel={facilitatorsError ? "Failed to load facilitators." : "No facilitators assigned yet."}
            allAssignedLabel="Every facilitator is assigned to this event."
          />
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-semibold text-fg">Speakers</p>
          <AssignmentTable
            assigned={assignedSpeakers}
            candidates={availableSpeakers}
            selectedId={selectedSpeakerId}
            onSelect={setSelectedSpeakerId}
            onAdd={onAddSpeaker}
            onRemove={(id) =>
              set(
                "speaker_profile_ids",
                values.speaker_profile_ids.filter((sid) => sid !== id),
              )
            }
            addButtonLabel="Assign"
            candidatePlaceholder="Select a speaker..."
            emptyLabel={speakersError ? "Failed to load speakers." : "No speakers assigned yet."}
            allAssignedLabel="Every speaker is assigned to this event."
          />
        </div>
      </FormSection>

      <FormSection title="Pricing" icon="payments">
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
      </FormSection>
    </>
  );
}
