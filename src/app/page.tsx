import Link from "next/link";

import { supabase } from "@/shared/db/client";
import * as eventDao from "@/modules/events/db/event.dao";
import { PostLoginRedirect } from "@/modules/auth/components/post-login-redirect";
import { EventGrid } from "@/modules/events/components/event-grid";
import { LandingHero } from "@/modules/shell/components/landing-hero";
import type { LandingEvent } from "@/shared/types";
import { toLandingEvent } from "@/modules/events/lib/landing-event";

// This page lists upcoming events, which change whenever staff publish one.
// Without this it was prerendered at build time (`○ /` in the build output) and
// the list stayed frozen until the next deploy: a newly published event never
// appeared, and a finished one never left. It also made the build itself depend
// on a reachable database, which is what broke the Build and Lighthouse jobs.
export const dynamic = "force-dynamic";

// The anon client, not the service client. The "Published events are public"
// policy already grants anon SELECT on active events, which is exactly what
// this query asks for. service_role would bypass RLS on a public page and,
// now that the page renders per request, make every request depend on a
// secret it does not need — a missing key would 500 the landing page.
async function getUpcomingEvents(): Promise<{ events: LandingEvent[]; total: number }> {
  const { events, total } = await eventDao.getUpcomingForLanding(supabase);
  return { events: events.map(toLandingEvent), total };
}

export default async function HomePage() {
  const { events, total } = await getUpcomingEvents();
  // Only when the strip is actually hiding something. A link promising more
  // that lands on the same three events is worse than no link.
  const hasMore = total > events.length;

  return (
    <>
      <PostLoginRedirect />
      <div className="flex flex-1 flex-col bg-bg text-fg">
        <LandingHero />
        <div className="px-6 py-12">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-bold text-fg">Upcoming Events</h2>
            {hasMore && (
              <Link
                href="/events"
                // `group`, so the underline is the label's alone. On the link
                // it also ran under the chevron, where a ligature glyph sitting
                // on the baseline made it read as a stray dash.
                className="group inline-flex items-center gap-1 text-sm font-semibold text-muted-fg outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="group-hover:underline">See all events</span>
                <span aria-hidden className="material-symbols-rounded text-base">
                  chevron_right
                </span>
              </Link>
            )}
          </div>
          <EventGrid events={events} backOrigin="landing" />
        </div>
      </div>
    </>
  );
}
