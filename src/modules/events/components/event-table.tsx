import Link from "next/link";

import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";

export interface EventTableRow {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  attendee_count?: number;
}

interface EventTableProps {
  events: EventTableRow[];
  /** Prefix for the Open/Title/Kiosk/Edit links. Defaults to /staff/events. */
  basePath?: string;
  /** Offer the Kiosk action (assigned facilitator view). */
  showKiosk?: boolean;
  /** Offer the Edit action (admin view). */
  showEdit?: boolean;
}

export function EventTable({ events, basePath = "/staff/events", showKiosk = false, showEdit = false }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">No events found.</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-5 py-3 font-semibold text-muted-fg">Title</th>
            <th className="px-5 py-3 font-semibold text-muted-fg">Date</th>
            <th className="px-5 py-3 font-semibold text-muted-fg">Time</th>
            <th className="px-5 py-3 font-semibold text-muted-fg">Venue</th>
            <th className="px-5 py-3 font-semibold text-muted-fg">Status</th>
            <th className="px-5 py-3 font-semibold text-muted-fg">Attendees</th>
            <th className="px-5 py-3 font-semibold text-muted-fg">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-muted">
              <td className="px-5 py-4">
                <Link href={`${basePath}/${event.id}`} className="font-medium text-fg hover:text-brand hover:underline">
                  {event.title}
                </Link>
              </td>
              <td className="px-5 py-4 text-muted-fg">{formatEventDate(event.event_date)}</td>
              <td className="px-5 py-4 text-muted-fg">
                {formatTime(event.start_time)} &ndash; {formatTime(event.end_time)}
              </td>
              <td className="px-5 py-4 text-muted-fg">{event.venue_name}</td>
              <td className="px-5 py-4">
                <EventStatusBadge
                  status={event.status}
                  date={event.event_date}
                  startTime={event.start_time}
                  endTime={event.end_time}
                />
              </td>
              <td className="px-5 py-4 text-muted-fg">{event.attendee_count ?? 0}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3 text-xs font-medium">
                  <Link href={`${basePath}/${event.id}`} className="text-brand hover:underline">
                    Open
                  </Link>
                  {showKiosk && (
                    <Link href={`${basePath}/${event.id}/kiosk`} className="text-fg hover:text-brand hover:underline">
                      Kiosk
                    </Link>
                  )}
                  {showEdit && (
                    <Link href={`${basePath}/${event.id}?tab=details`} className="text-fg hover:text-brand hover:underline">
                      Edit
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
