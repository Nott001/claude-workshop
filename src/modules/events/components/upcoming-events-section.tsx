import type { LandingEvent } from "@/shared/types";
import { EventGrid } from "./event-grid";
import type { BackLinkOrigin } from "@/shared/lib/back-link";

/** The landing strip: "Upcoming Events" and the grid it heads. Shared by the
 *  guest and attendee landings so the header cannot exist on one and vanish
 *  from the other again. */
export function UpcomingEventsSection({ events, backOrigin }: { events: LandingEvent[]; backOrigin?: BackLinkOrigin }) {
  return (
    <div className="px-6 py-12">
      <h2 className="mb-6 text-lg font-bold text-fg">Upcoming Events</h2>
      <EventGrid events={events} backOrigin={backOrigin} />
    </div>
  );
}
