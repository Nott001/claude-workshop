import { Footer } from "@/shared/components/footer";
import { supabase } from "@/shared/db/client";
import * as eventDao from "@/shared/db/dao/event.dao";
import { PostLoginRedirect } from "@/modules/auth/components/post-login-redirect";
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
      <div className="min-h-screen bg-bg text-fg">
        <section className="relative overflow-hidden rounded-b-[40px] bg-brand px-6 py-10 sm:px-12 lg:px-16 lg:py-8">
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative mx-auto max-w-[1110px]">
            <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
            <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
              StartupLab Business Center
            </h1>
            <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
              Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness
              artificial intelligence effectively for growth and innovation.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[1110px] px-6 py-12">
          <h2 className="mb-6 text-lg font-bold text-fg">Upcoming Events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-fg">No upcoming events.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <div key={event.event_id} className="rounded-xl border border-border bg-surface p-4">
                  <h3 className="text-sm font-semibold text-fg">{event.title}</h3>
                  <p className="mt-1 text-xs text-muted-fg">{event.event_date}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
