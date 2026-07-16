import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

import { MarketingFooter } from "@/components/marketing-footer";
import { EventCard } from "@/components/event-card";
import { getUpcomingEvents, formatEventDate, formatTime, eventStatusLabel } from "@/lib/landing";

export default async function HomePage() {
  const events = await getUpcomingEvents();
  const featured = events[0] ?? null;

  return (
    <main className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c]">
      <div>
        <section className="relative overflow-hidden rounded-b-[40px] bg-[#3db9ee] px-6 py-10 sm:px-12 lg:px-16 lg:py-8">
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative mx-auto grid max-w-[1110px] items-center gap-10 lg:min-h-[427px] lg:grid-cols-[1.1fr_.8fr] lg:gap-12">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
              <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                StartupLab
                <br />
                Business Center
              </h1>
              <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
                Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness
                artificial intelligence effectively for growth and innovation.
              </p>
              <Link
                href="/sign-up"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-[#3db9ee] shadow-lg shadow-sky-900/10 transition hover:-translate-y-0.5"
              >
                Join Now <ArrowRight className="size-[18px]" />
              </Link>
            </div>
            <div className="relative mx-auto w-full max-w-[448px] overflow-hidden rounded-3xl border border-white/40 bg-white/40 p-1 shadow-2xl shadow-sky-950/20 backdrop-blur-sm">
              <div className="relative flex aspect-[1.85] items-end overflow-hidden rounded-[20px] bg-gradient-to-br from-[#153d64] via-[#1b7295] to-[#5dd3e7] p-6">
                <div className="absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(circle_at_40%_0%,rgba(255,255,255,.5),transparent_42%)]" />
                <div className="relative w-full rounded-2xl border border-white/25 bg-slate-950/30 p-4 text-white backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs font-medium text-white/80">
                    <span>{featured?.title ?? "Workshop"}</span>
                    <span>{featured ? eventStatusLabel(featured.status) : "Live session"}</span>
                  </div>
                  {featured && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-white text-[#269fcf]">
                        <Play className="ml-0.5 size-4 fill-current" />
                      </span>
                      <span className="text-sm font-semibold">
                        {formatEventDate(featured.event_date)} at {formatTime(featured.start_time)}
                      </span>
                    </div>
                  )}
                </div>
                <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#3db9ee] shadow-lg">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="upcoming-events" className="bg-white px-6 py-20 sm:px-12 lg:px-16">
          <div className="mx-auto max-w-[1110px]">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[32px]">Upcoming Events</h2>
              <p className="mt-4 text-base leading-6 text-[#3e484f]">
                Live workshops and networking events designed to keep you at the forefront of business innovation.
              </p>
            </div>
            <div className={`mt-12 gap-6 ${events.length === 1 ? "grid" : "grid lg:grid-cols-2"}`}>
              {events.length === 1 ? (
                <div className="lg:col-span-2 mx-auto w-full max-w-[66%]">
                  <EventCard
                    eventId={events[0].event_id}
                    title={events[0].title}
                    status={events[0].status}
                    date={events[0].event_date}
                    startTime={events[0].start_time}
                    endTime={events[0].end_time}
                    venueName={events[0].venue_name}
                    coverImageUrl={events[0].cover_image_url}
                    accentIndex={0}
                  />
                </div>
              ) : (
                events.map((event, index) => (
                  <EventCard
                    key={event.event_id}
                    eventId={event.event_id}
                    title={event.title}
                    status={event.status}
                    date={event.event_date}
                    startTime={event.start_time}
                    endTime={event.end_time}
                    venueName={event.venue_name}
                    coverImageUrl={event.cover_image_url}
                    accentIndex={index}
                  />
                ))
              )}
            </div>
            {events.length > 0 && (
              <div className="mt-12 text-center">
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#3db9ee] px-8 py-3 text-sm font-semibold text-[#168cb9] transition hover:bg-[#effaff]"
                >
                  See All Upcoming Events <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
            {events.length === 0 && (
              <div className="mt-12 text-center text-sm text-[#526069]">No upcoming events at the moment. Check back soon!</div>
            )}
          </div>
        </section>

        <div className="px-6 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto max-w-[1110px]">
            <MarketingFooter />
          </div>
        </div>
      </div>
    </main>
  );
}
