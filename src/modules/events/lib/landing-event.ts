import type { LandingEvent } from "@/shared/types";

/** An EVENT row as `/api/events` and the landing page query return it. */
export interface EventRow {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  cover_image_url?: string | null;
  COURSE?: { course_name: string } | null;
}

/**
 * The table's primary key is `id` and the course name arrives nested in the
 * COURSE embed; LandingEvent calls the key `event_id` and flattens the name.
 * Consuming the rows as LandingEvent without converting left every `event_id`
 * undefined — a list of duplicate undefined React keys, and every card linking
 * to /events/undefined. Both producers convert through here so the next one
 * cannot skip it.
 */
export function toLandingEvent(row: EventRow): LandingEvent {
  return {
    event_id: row.id,
    title: row.title,
    event_date: row.event_date,
    start_time: row.start_time,
    end_time: row.end_time,
    venue_name: row.venue_name,
    status: row.status,
    course_name: row.COURSE?.course_name ?? null,
    cover_image_url: row.cover_image_url ?? null,
  };
}
