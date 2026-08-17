"use client";

import { Button } from "@/shared/components/button";
import { SectionCard, StatGrid } from "@/shared/components/section-card";
import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { formatVenue } from "@/shared/lib/event-format";
import type { EventWithCourse } from "@/modules/events/lib/types";

interface EventOverviewPanelProps {
  event: EventWithCourse;
  attendeeCount: number | undefined;
  /** Admin only: the server refuses a delete from a facilitator anyway. */
  canDelete: boolean;
  deleteError: string | null;
  onDelete: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2.5 last:border-0">
      <dt className="text-sm text-muted-fg">{label}</dt>
      <dd className="text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}

/**
 * What the event *is*, read-only. Editing it is the Details tab's job — the two
 * used to share this panel, which is how a whole edit form ended up nested in a
 * summary card.
 */
export function EventOverviewPanel({ event, attendeeCount, canDelete, deleteError, onDelete }: EventOverviewPanelProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Overview" icon="space_dashboard">
        <StatGrid
          stats={[
            { label: "Attendees", value: attendeeCount ?? 0 },
            { label: "Status", value: event.status },
            { label: "Price", value: event.price > 0 ? `${event.currency} ${event.price}` : "Free" },
          ]}
        />

        <p className="mt-5 text-sm leading-relaxed text-fg">
          {event.description || <span className="text-muted-fg">No description yet.</span>}
        </p>
      </SectionCard>

      <SectionCard title="Details" icon="info">
        <dl>
          <DetailRow label="Date" value={formatEventDate(event.event_date)} />
          <DetailRow label="Time" value={`${formatTime(event.start_time)} – ${formatTime(event.end_time)}`} />
          <DetailRow label="Venue" value={formatVenue(event.venue_name, event.venue_address) || event.venue_name} />
          <DetailRow label="Course" value={event.COURSE?.course_name ?? "None yet"} />
        </dl>
      </SectionCard>

      {canDelete && (
        <SectionCard title="Danger zone" icon="warning" description="Deleting an event also removes its tickets and course.">
          {deleteError && <p className="mb-3 text-sm text-error">{deleteError}</p>}
          <Button variant="danger" onClick={onDelete}>
            Delete event
          </Button>
        </SectionCard>
      )}
    </div>
  );
}
