"use client";

import Link from "next/link";
import { useSession } from "@/modules/auth/components/session-context";
import { HeroSection } from "@/modules/shell/components/hero-section";

export function LandingHero() {
  const { isSignedIn, user } = useSession();
  const firstName = user?.full_name?.split(/\s+/)[0] ?? "there";

  return (
    <HeroSection>
      <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
      <h1 className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
        {isSignedIn ? `Welcome, ${firstName}!` : "StartupLab Business Center"}
      </h1>
      <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
        Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness artificial
        intelligence effectively for growth and innovation.
      </p>
      {!isSignedIn && (
        <Link
          href="/sign-up"
          // Above the fold on the app's most-visited page, so its prefetch
          // fired for every visitor including the ones already signed in.
          prefetch={false}
          className="mt-8 inline-flex rounded-xl bg-white px-8 py-4 text-base leading-6 font-bold text-brand transition hover:bg-white/90"
        >
          Join Now
        </Link>
      )}
    </HeroSection>
  );
}
