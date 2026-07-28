import { Footer } from "@/shared/components/footer";
import { getServiceClient } from "@/shared/db/client";
import { eventDao } from "@/shared/db/dao";
import { PostLoginRedirect } from "@/modules/auth/components/post-login-redirect";
import type { LandingEvent } from "@/shared/types";

async function getUpcomingEvents(): Promise<LandingEvent[]> {
  const supabase = getServiceClient();
  const data = await eventDao.getUpcomingForLanding(supabase);
  return data.map((e) => ({
    event_id: e.id,
    title: e.title,
    event_date: e.event_date,
    start_time: e.start_time,
    end_time: e.end_time,
    venue_name: e.venue_name,
    status: e.status,
    course_name: e.COURSE?.course_name ?? null,
    cover_image_url: e.cover_image_url ?? null,
  }));
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

        <Footer role="attendee" />
      </div>
    </>
  );
}
