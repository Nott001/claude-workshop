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
async function getUpcomingEvents(): Promise<LandingEvent[]> {
  const data = await eventDao.getUpcomingForLanding(supabase);
  return data.map(toLandingEvent);
}

export default async function HomePage() {
  const events = await getUpcomingEvents();

  return (
    <>
      <PostLoginRedirect />
      <div className="flex flex-1 flex-col bg-bg text-fg">
        <LandingHero />
        <div className="px-6 py-12">
          <h2 className="mb-6 text-lg font-bold text-fg">Upcoming Events</h2>
          <EventGrid events={events} backOrigin="landing" />
        </div>
      </div>
    </>
  );
}
