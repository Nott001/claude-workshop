"use client";

import { useRouter } from "next/navigation";
import { AddToCalendar } from "@/modules/events/components/event-add-to-calendar";
import { Button } from "@/shared/components/button";
import { formatEventPrice } from "@/shared/lib/event-format";
import { isEventFinished, isEventStarted } from "@/shared/lib/date-utils";
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
  // Either read is sufficient: the detail routes already serve the effective
  // status, so a plain expired `active` event arrives as "complete"; the time
  // check covers any path that hands over the raw row, on the same local clock
  // the server's ensureRegistrable guard uses.
  const finished = event.status === "complete" || isEventFinished(event.event_date, event.end_time);
  // Served only for a capped event, and only as a remainder — the attendee
  // count itself stays staff-only.
  const seatsLeft = event.seats_left ?? null;

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
  } else if (!hasTicket && finished) {
    label = "Completed";
    locked = true;
  } else if (!hasTicket && seatsLeft === 0) {
    // The register route refuses this too; the button is here so a reader is
    // not sent down a flow that ends in a rejection.
    label = "Sold out";
    locked = true;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      {/* Price and, for a capped event, what is left of it — the venue moved to
          the address card, which now carries the map. A ticket holder is shown
          neither, so the list is dropped rather than rendered empty with its
          margin still there. */}
      {!hasTicket && (price || seatsLeft !== null) && (
        <ul className="mb-5 space-y-3 text-sm">
          {price && (
            <li className={ROW}>
              <span className="flex items-center gap-2 text-muted-fg">
                <span aria-hidden className="material-symbols-rounded text-base text-brand">
                  sell
                </span>
                Price
              </span>
              <span className={VALUE}>{price}</span>
            </li>
          )}
          {seatsLeft !== null && (
            <li className={ROW}>
              <span className="flex items-center gap-2 text-muted-fg">
                <span aria-hidden className="material-symbols-rounded text-base text-brand">
                  event_seat
                </span>
                Seats left
              </span>
              <span className={VALUE}>{seatsLeft > 0 ? seatsLeft.toLocaleString() : "None"}</span>
            </li>
          )}
        </ul>
      )}

      <Button className="w-full" onClick={onAction} disabled={locked}>
        {label}
      </Button>

      <div className="mt-2.5">
        <AddToCalendar event={event} />
      </div>
    </div>
  );
}
