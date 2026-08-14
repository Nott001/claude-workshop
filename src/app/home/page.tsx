"use client";

import { useSession } from "@/modules/auth/components/session-context";

import { formatEventDate, formatTime, eventStatusLabel } from "@/shared/lib/date-utils";
import { useUpcomingEvents } from "@/modules/events/lib/use-upcoming-events";
import { EventGrid } from "@/modules/events/components/event-grid";
import { HeroSection, HeroMediaCard } from "@/modules/shell/components/hero-section";

export default function HomePage() {
  const { user } = useSession();
  const { events } = useUpcomingEvents();

  const featured = events[0] ?? null;
  const firstName = user?.full_name?.split(/\s+/)[0] ?? "there";

  return (
    <>
      <div className="flex flex-1 flex-col bg-bg text-fg">
        <HeroSection
          media={
            <HeroMediaCard>
              <div className="relative w-full rounded-2xl border border-white/25 bg-slate-950/30 p-4 text-white backdrop-blur-md">
                <div className="flex items-center justify-between text-xs font-medium text-white/80">
                  <span>{featured?.title ?? "Workshop"}</span>
                  <span>{featured ? eventStatusLabel(featured.status) : "Live session"}</span>
                </div>
                {featured && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-surface text-brand">
                      <span aria-hidden className="material-symbols-rounded ml-0.5 text-base">
                        play_arrow
                      </span>
                    </span>
                    <span className="text-sm font-semibold">
                      {formatEventDate(featured.event_date)} at {formatTime(featured.start_time)}
                    </span>
                  </div>
                )}
              </div>
            </HeroMediaCard>
          }
        >
          <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
          <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
            Welcome, {firstName}!
          </h1>
          <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
            Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness
            artificial intelligence effectively for growth and innovation.
          </p>
        </HeroSection>

        <div className="px-6 py-12">
          <EventGrid events={events} backOrigin="home" />
        </div>
      </div>
    </>
  );
}
