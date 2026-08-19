// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";

import { CardLink } from "@/shared/components/card-link";
import { EventCard } from "@/modules/events/components/event-card";
import { EventMemoryCard } from "@/modules/community/components/event-memory-card";
import type { LandingEvent } from "@/shared/types";

afterEach(cleanup);

const landingEvent: LandingEvent = {
  event_id: 7,
  title: "Live QA Workshop",
  event_date: "2026-05-01",
  start_time: "09:00",
  end_time: "12:00",
  venue_name: "Startup Lab",
  status: "complete",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
};

/** The class list of the anchor a component renders. */
const shellOf = (container: HTMLElement) => container.querySelector("a")!.className.split(" ");

// The prefetch policy is asserted in link-prefetch.test.tsx, which owns the
// `next/link` stand-in that makes the prop observable — `next/link` consumes it
// rather than forwarding it to the anchor.
describe("CardLink", () => {
  it("lays out as a block unless the caller needs otherwise", () => {
    const { container } = render(<CardLink href="/events/7">card</CardLink>);

    expect(shellOf(container)).toContain("block");
  });

  it("lets a caller replace the display without both landing on the element", () => {
    const { container } = render(
      <CardLink href="/events/7" className="flex h-full flex-col">
        card
      </CardLink>,
    );

    // `cn` is tailwind-merge, so this is a replacement rather than two display
    // utilities fighting in the cascade.
    const classes = shellOf(container);
    expect(classes).toContain("flex");
    expect(classes).not.toContain("block");
  });

  it("gives the event card and the memory card the same shell", () => {
    const { container: eventCard } = render(
      <EventCard
        eventId={7}
        title="Live QA"
        status="complete"
        date="2026-05-01"
        startTime="09:00"
        endTime="12:00"
        venueName="Startup Lab"
      />,
    );
    const { container: memoryCard } = render(<EventMemoryCard event={landingEvent} photos={[]} photoCount={0} />);

    // The reason the shell was extracted: the two sit in grids of the same
    // shape on pages a reader moves between. Display aside, every surface and
    // motion class must match, and this fails if either card grows its own.
    const ignoreDisplay = (c: string[]) => c.filter((x) => !["block", "flex", "flex-col", "h-full"].includes(x));
    expect(ignoreDisplay(shellOf(eventCard)).sort()).toEqual(ignoreDisplay(shellOf(memoryCard)).sort());
  });

  it("guards the movement behind motion-safe, but not the shadow", () => {
    const { container } = render(<CardLink href="/events/7">card</CardLink>);
    const classes = shellOf(container);

    // Movement is what a reader who asked their system for reduced motion is
    // asking to be spared — a vestibular trigger, not a taste. A shadow
    // deepening in place still answers the hover and moves nothing, so it is
    // deliberately left unguarded.
    expect(classes).toContain("motion-safe:hover:scale-[1.02]");
    expect(classes).not.toContain("hover:scale-[1.02]");
    expect(classes.some((c) => c.startsWith("hover:shadow-"))).toBe(true);
  });

  it("leaves no scale in either card unguarded", () => {
    const sources = [
      "src/shared/components/card-link.tsx",
      "src/modules/events/components/event-card.tsx",
      "src/modules/community/components/event-memory-card.tsx",
    ].map((rel) => readFileSync(path.resolve(__dirname, "..", rel), "utf8"));

    // The inner media scales to 1.05 — more movement than the card's own 1.02 —
    // so guarding only the shell would leave the larger motion in place.
    //
    // Guarded occurrences are deleted and the remainder checked, rather than
    // asking whether the guarded spelling appears somewhere in the file: the
    // first version of this test did the latter, and a second guarded scale
    // elsewhere in the same file happily vouched for an unguarded one.
    for (const source of sources) {
      const unguarded = source.replace(/motion-safe:(?:group-)?hover:scale-\[?[\d.]+\]?/g, "");
      expect(unguarded).not.toMatch(/hover:scale-/);
    }
  });
});
