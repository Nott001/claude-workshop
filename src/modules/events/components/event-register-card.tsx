"use client";

import { useRouter } from "next/navigation";
import { AddToCalendar } from "@/modules/events/components/event-add-to-calendar";
import { Button } from "@/shared/components/button";
import { formatEventPrice, formatVenue } from "@/shared/lib/event-format";
import { isEventStarted } from "@/shared/lib/date-utils";
import type { EventWithCourse } from "@/modules/events/lib/types";

interface EventRegisterCardProps {
  event: EventWithCourse;
  hasTicket: boolean;
  isSignedIn: boolean;
  onRegister: () => void;
}

const ROW = "flex items-center justify-between";
const VALUE = "ml-4 min-w-0 text-right font-semibold";

export function EventRegisterCard({ event, hasTicket, onRegister }: EventRegisterCardProps) {
  const router = useRouter();
  const price = formatEventPrice(event.price, event.currency);
  const courseId = event.COURSE?.id;
  const eventStarted = isEventStarted(event.event_date, event.start_time);

  let label = "Register";
  let onAction = onRegister;
  let locked = false;
  if (hasTicket && !eventStarted) {
    // A ticket holder's entry point is the room, but the room stays shut
    // until the event starts — so the button sits locked until the opening
    // edge has passed, whether or not a course is linked yet.
    label = "Locked until start";
    locked = true;
  } else if (hasTicket && courseId) {
    label = "Enter Room";
    onAction = () => router.push(`/courses/${courseId}/room`);
  } else if (hasTicket) {
    label = "View Ticket";
    onAction = () => router.push("/tickets");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <ul className="mb-5 space-y-3 text-sm">
        <li className={ROW}>
          <span className="flex items-center gap-2 text-muted-fg">
            <span className="material-symbols-rounded text-base text-brand">location_on</span>
            Venue
          </span>
          <span className={VALUE}>{formatVenue(event.venue_name, event.venue_address)}</span>
        </li>
        {!hasTicket && price && (
          <li className={ROW}>
            <span className="flex items-center gap-2 text-muted-fg">
              <span className="material-symbols-rounded text-base text-brand">sell</span>
              Price
            </span>
            <span className={VALUE}>{price}</span>
          </li>
        )}
      </ul>

      <Button className="w-full" onClick={onAction} disabled={locked}>
        {label}
      </Button>

      <div className="mt-2.5">
        <AddToCalendar event={event} />
      </div>
    </div>
  );
}
