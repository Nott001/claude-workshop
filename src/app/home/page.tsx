"use client";

import { useSession } from "@/modules/auth/components/session-context";

import { useUpcomingEvents } from "@/modules/events/lib/use-upcoming-events";
import { EventGrid } from "@/modules/events/components/event-grid";
import { HeroSection } from "@/modules/shell/components/hero-section";

export default function HomePage() {
  const { user } = useSession();
  const { events } = useUpcomingEvents();

  const firstName = user?.full_name?.split(/\s+/)[0] ?? "there";

  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      <HeroSection>
        <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
        <h1 className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
          Welcome, {firstName}!
        </h1>
        <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
          Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness artificial
          intelligence effectively for growth and innovation.
        </p>
      </HeroSection>

      {/* The featured event used to be spelled out in the hero. It was the same
          events[0] this grid already leads with, so the duplicate went with the
          media tile rather than being restyled. */}
      <div className="px-6 py-12">
        <EventGrid events={events} backOrigin="home" />
      </div>
    </div>
  );
}
