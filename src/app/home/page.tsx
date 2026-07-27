"use client";

import { useSession } from "@/modules/auth";

import { Footer } from "@/components/footer";
import { formatEventDate, formatTime } from "@/lib/date-utils";
import { eventStatusLabel } from "@/lib/landing";
import { useUpcomingEvents } from "@/modules/event-management/lib/use-upcoming-events";
import { EventGrid } from "@/modules/event-management/ui/event-grid";

export default function HomePage() {
  const { user } = useSession();
  const { events } = useUpcomingEvents();

  const featured = events[0] ?? null;
  const firstName = user?.full_name?.split(/\s+/)[0] ?? "there";

  return (
    <>
      <div className="min-h-screen bg-bg text-fg">
        <section className="relative overflow-hidden rounded-b-[40px] bg-brand px-6 py-10 sm:px-12 lg:px-16 lg:py-8">
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative mx-auto grid max-w-[1110px] items-center gap-10 lg:min-h-[427px] lg:grid-cols-[1.1fr_.8fr] lg:gap-12">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
              <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                Welcome, {firstName}!
              </h1>
              <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
                Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness
                artificial intelligence effectively for growth and innovation.
              </p>
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
                      <span className="grid size-10 place-items-center rounded-full bg-surface text-brand">
                        <span className="material-symbols-rounded ml-0.5 text-base">play_arrow</span>
                      </span>
                      <span className="text-sm font-semibold">
                        {formatEventDate(featured.event_date)} at {formatTime(featured.start_time)}
                      </span>
                    </div>
                  )}
                </div>
                <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand shadow-lg">
                  <span className="material-symbols-rounded ml-0.5 text-lg">play_arrow</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <EventGrid events={events} />

        <Footer role="attendee" />
      </div>
    </>
  );
}
