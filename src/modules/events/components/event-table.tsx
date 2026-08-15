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
  TableEmpty,
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
  const [selected, setSelected] = useState<EventTableRow | null>(null);

  if (events.length === 0) {
    return <TableEmpty icon="event" title="No events found" />;
  }

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Date</TableHeadCell>
              <TableHeadCell>Time</TableHeadCell>
              <TableHeadCell>Venue</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Attendees</TableHeadCell>
              <TableHeadCell className="w-12" aria-label="Actions" />
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id} onClick={() => setSelected(event)} aria-label={`Open ${event.title}`}>
                <TableCell>
                  {/* Title survives as a link; clicking it navigates, not opens the drawer. */}
                  <Link
                    href={`${basePath}/${event.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-fg hover:text-brand hover:underline"
                  >
                    {event.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-fg">{formatEventDate(event.event_date)}</TableCell>
                <TableCell className="text-muted-fg">
                  {formatTime(event.start_time)} &ndash; {formatTime(event.end_time)}
                </TableCell>
                <TableCell className="text-muted-fg">{event.venue_name}</TableCell>
                <TableCell>
                  <EventStatusBadge
                    status={event.status}
                    date={event.event_date}
                    startTime={event.start_time}
                    endTime={event.end_time}
                  />
                </TableCell>
                <TableCell className="text-muted-fg">{event.attendee_count ?? 0}</TableCell>
                <TableCell className="w-12">
                  <span aria-hidden className="material-symbols-rounded text-base text-muted-fg">
                    chevron_right
                  </span>
                </TableCell>
              </TableRow>
            ))}
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
              <span>{selected.attendee_count ?? 0}</span>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
