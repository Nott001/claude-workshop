"use client";

import { useRouter } from "next/navigation";
import { AddToCalendar } from "@/modules/events/components/event-add-to-calendar";
import { CountdownTimer } from "@/modules/events/components/countdown-timer";
import { Button } from "@/shared/components/button";
import { formatEventPrice, formatVenue } from "@/shared/lib/event-format";
import type { EventWithCourse } from "@/modules/events/lib/types";

interface EventRegisterCardProps {
  event: EventWithCourse;
  hasTicket: boolean;
  isSignedIn: boolean;
  onRegister: () => void;
}

const ROW = "flex items-center justify-between";

export function EventRegisterCard({ event, hasTicket, isSignedIn, onRegister }: EventRegisterCardProps) {
  const router = useRouter();
  const price = formatEventPrice(event.price, event.currency);
  const courseId = event.COURSE?.id;

  let label = "Register";
  let onAction = onRegister;
  if (hasTicket && courseId) {
    label = "Enter Room";
    onAction = () => router.push(`/courses/${courseId}/room`);
  } else if (hasTicket && !courseId) {
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
          <span className="font-semibold">{formatVenue(event.venue_name, event.venue_address)}</span>
        </li>
        {price && (
          <li className={ROW}>
            <span className="flex items-center gap-2 text-muted-fg">
              <span className="material-symbols-rounded text-base text-brand">sell</span>
              Price
            </span>
            <span className="font-semibold">{price}</span>
          </li>
        )}
      </ul>

      <Button className="w-full" onClick={onAction}>
        {label}
      </Button>

      <div className="mt-5 flex flex-col gap-4 border-t pt-5">
        <CountdownTimer eventDate={event.event_date} startTime={event.start_time} />
        <AddToCalendar event={event} />
      </div>
    </div>
  );
}
