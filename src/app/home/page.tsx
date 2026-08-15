"use client";

import { useSession } from "@/modules/auth/components/session-context";
import { FeaturedSessionCard } from "@/modules/events/components/featured-session-card";
import { UpcomingEventsSection } from "@/modules/events/components/upcoming-events-section";
import { useUpcomingEvents } from "@/modules/events/lib/use-upcoming-events";
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
              <FeaturedSessionCard event={featured} />
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

        <UpcomingEventsSection events={events} backOrigin="home" />
      </div>
    </>
  );
}
