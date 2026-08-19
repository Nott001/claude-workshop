// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { EventMemoryCard } from "@/modules/community/components/event-memory-card";
import type { EventPhoto, LandingEvent } from "@/shared/types";

afterEach(cleanup);

const event: LandingEvent = {
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

const photos = (count: number): EventPhoto[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    event_id: 7,
    image_url: `/api/storage/event_images/events/7/photos/${i + 1}.jpg`,
    caption: null,
    sequence_order: i,
    created_at: "2026-05-01T00:00:00Z",
  }));

describe("EventMemoryCard", () => {
  it("leads with the event's photos rather than restating its detail page", () => {
    const { container } = render(<EventMemoryCard event={event} photos={photos(3)} photoCount={3} />);

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(3);
    expect(images[0].getAttribute("src")).toBe("/api/storage/event_images/events/7/photos/1.jpg");
  });

  it("offers the whole archive, not just the tiles it shows", () => {
    render(<EventMemoryCard event={event} photos={photos(4)} photoCount={26} />);

    // The card holds four thumbnails; the link is what gets you the other 22.
    expect(screen.getByText(/View 26 photos/)).toBeTruthy();
  });

  it("says photo, singular, for an event with one", () => {
    render(<EventMemoryCard event={event} photos={photos(1)} photoCount={1} />);

    expect(screen.getByText(/View 1 photo$/)).toBeTruthy();
  });

  it("never renders more tiles than the mosaic holds", () => {
    const { container } = render(<EventMemoryCard event={event} photos={photos(9)} photoCount={9} />);

    expect(container.querySelectorAll("img")).toHaveLength(4);
  });

  it("holds the picture area for an event nobody photographed", () => {
    const { container } = render(<EventMemoryCard event={event} photos={[]} photoCount={0} />);

    // Still on the strip, and still shaped like a memory. Dropping the picture
    // area gives back the text-only card this strip used to be, and leaves the
    // row ragged beside cards that do have photographs.
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText("No photos yet")).toBeTruthy();
    expect(screen.getByText("Live QA Workshop")).toBeTruthy();
    expect(screen.getByText(/View memories/)).toBeTruthy();
  });

  it("leaves the venue off, which is live-event information", () => {
    render(<EventMemoryCard event={event} photos={photos(2)} photoCount={2} />);

    expect(screen.queryByText("Startup Lab")).toBeNull();
  });

  it("gives an empty card the same picture area a full one has", () => {
    const { container: empty } = render(<EventMemoryCard event={event} photos={[]} photoCount={0} />);
    const emptyArea = empty.querySelector(".aspect-\\[1\\.85\\]");
    cleanup();
    const { container: full } = render(<EventMemoryCard event={event} photos={photos(4)} photoCount={4} />);

    // Same aspect box in both, so the grid does not go ragged the moment one
    // session goes unphotographed.
    expect(emptyArea).toBeTruthy();
    expect(full.querySelector(".aspect-\\[1\\.85\\]")).toBeTruthy();
  });

  it("opens the archive, not the event's registration page", () => {
    const { container } = render(<EventMemoryCard event={event} photos={photos(2)} photoCount={2} />);

    const href = within(container).getByRole("link").getAttribute("href");
    // Landing on the event page is what made a memory a link to a sold-out
    // registration form for a session that already happened.
    expect(href).toBe("/events/7/memories?from=community");
  });

  it("opens the archive even when it is empty", () => {
    const { container } = render(<EventMemoryCard event={event} photos={[]} photoCount={0} />);

    // An empty archive is an answer, and the page it opens says so. Diverting
    // to the event page instead is the redirect this whole feature removed.
    expect(within(container).getByRole("link").getAttribute("href")).toBe("/events/7/memories?from=community");
  });

  it("leaves the tiles out of the accessibility tree, since the heading names the event", () => {
    const { container } = render(<EventMemoryCard event={event} photos={photos(3)} photoCount={3} />);

    // One link announced once, not once per thumbnail inside it.
    for (const img of container.querySelectorAll("img")) {
      expect(img.getAttribute("alt")).toBe("");
    }
  });
});
