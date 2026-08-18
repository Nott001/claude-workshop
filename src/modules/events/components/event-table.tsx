"use client";

import Link from "next/link";
import { useState } from "react";

import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";
import { buttonStyles } from "@/shared/components/button";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableBodyState,
  TableContainer,
} from "@/shared/components/table";
import { Drawer } from "@/shared/components/drawer";

const actionClass = buttonStyles({ variant: "secondary", size: "sm" });

export interface EventTableRow {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  attendee_count?: number;
  /** Seat cap, or null/absent for an uncapped event. */
  capacity?: number | null;
}

/** "12 / 50" for a capped event, "12" for one with no cap. */
function attendance(event: EventTableRow): string {
  const taken = event.attendee_count ?? 0;
  return event.capacity == null ? String(taken) : `${taken} / ${event.capacity}`;
}

interface EventTableProps {
  events: EventTableRow[];
  /** Prefix for the Open/Title/Kiosk/Edit links. Defaults to /staff/events. */
  basePath?: string;
  /** Offer the Kiosk action (assigned facilitator view). */
  showKiosk?: boolean;
  /** Offer the Edit action (admin view). */
  showEdit?: boolean;
  /** True while a search refetch is in flight, so rows are dimmed, not unmounted. */
  loading?: boolean;
}

export function EventTable({
  events,
  basePath = "/staff/events",
  showKiosk = false,
  showEdit = false,
  loading = false,
}: EventTableProps) {
  const [selected, setSelected] = useState<EventTableRow | null>(null);

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell className="w-28">Date</TableHeadCell>
              <TableHeadCell className="w-28">Time</TableHeadCell>
              <TableHeadCell className="w-36">Venue</TableHeadCell>
              <TableHeadCell className="w-28">Status</TableHeadCell>
              <TableHeadCell className="w-20">Attendees</TableHeadCell>
              <TableHeadCell className="w-12" aria-label="Actions" />
            </TableRow>
          </TableHead>
          <TableBody busy={loading && events.length > 0}>
            <TableBodyState
              ready={events.length > 0}
              loading={loading}
              colSpan={7}
              empty={{ icon: "event", title: "No events found" }}
            >
              {events.map((event) => (
                <TableRow key={event.id} onClick={() => setSelected(event)} aria-label={`Open ${event.title}`}>
                  <TableCell className="min-w-0">
                    {/* Title survives as a link; clicking it navigates, not opens the drawer. */}
                    <Link
                      href={`${basePath}/${event.id}`}
                      onClick={(e) => e.stopPropagation()}
                      // One per row, so a full page of events renders a page of
                      // detail views nobody opened. The drawer's own actions
                      // below keep their prefetch: they exist only once a row has
                      // been clicked, which is intent rather than arrival.
                      prefetch={false}
                      className="block truncate font-medium text-fg hover:text-brand hover:underline"
                    >
                      {event.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-fg">{formatEventDate(event.event_date)}</TableCell>
                  <TableCell className="text-muted-fg">
                    {formatTime(event.start_time)} &ndash; {formatTime(event.end_time)}
                  </TableCell>
                  <TableCell className="truncate text-muted-fg">{event.venue_name}</TableCell>
                  <TableCell>
                    <EventStatusBadge
                      status={event.status}
                      date={event.event_date}
                      startTime={event.start_time}
                      endTime={event.end_time}
                    />
                  </TableCell>
                  <TableCell className="text-muted-fg">{attendance(event)}</TableCell>
                  <TableCell className="w-12">
                    <span aria-hidden className="material-symbols-rounded text-base text-muted-fg">
                      chevron_right
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBodyState>
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.title ?? ""}
        description={selected ? formatEventDate(selected.event_date) : undefined}
        footer={
          selected && (
            <div className="flex items-center gap-2">
              <Link href={`${basePath}/${selected.id}`} className={actionClass}>
                Open
              </Link>
              {showKiosk && (
                <Link href={`${basePath}/${selected.id}/kiosk`} className={actionClass}>
                  Kiosk
                </Link>
              )}
              {showEdit && (
                <Link href={`${basePath}/${selected.id}`} className={actionClass}>
                  Edit
                </Link>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Time</span>
              <span>
                {formatTime(selected.start_time)} &ndash; {formatTime(selected.end_time)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Venue</span>
              <span>{selected.venue_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Status</span>
              <EventStatusBadge
                status={selected.status}
                date={selected.event_date}
                startTime={selected.start_time}
                endTime={selected.end_time}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-fg">Attendees</span>
              <span>{attendance(selected)}</span>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
