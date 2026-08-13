import Link from "next/link";
import { supabase } from "@/shared/db/client";
import * as eventDao from "@/modules/events/db/event.dao";
import { PostLoginRedirect } from "@/modules/auth/components/post-login-redirect";
import { EventGrid } from "@/modules/events/components/event-grid";
import { HeroSection, HeroMediaCard } from "@/modules/shell/components/hero-section";
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
        <HeroSection media={<HeroMediaCard />}>
          <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl sm:leading-[60px]">
            StartupLab Business Center
          </h1>
          <p className="mt-4 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
            Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness
            artificial intelligence effectively for growth and innovation.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex rounded-xl bg-white px-8 py-4 text-base leading-6 font-bold text-brand transition hover:bg-white/90"
          >
            Join Now
          </Link>
        </HeroSection>

        <div className="px-6 py-12">
          <h2 className="mb-6 text-lg font-bold text-fg">Upcoming Events</h2>
          <EventGrid events={events} />
        </div>
      </div>
    </>
  );
}
