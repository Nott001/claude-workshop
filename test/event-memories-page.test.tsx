// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "7" }) }));

import { EventMemoriesPage } from "@/modules/events/pages/event-memories";
import type { EventPhoto } from "@/shared/types";

const event = {
  id: 7,
  title: "Prompt Engineering Workshop",
  event_date: "2026-06-21",
  start_time: "09:00",
  end_time: "12:00",
  venue_name: "StartupLab Hub",
  status: "complete",
};

const photos = (count: number): EventPhoto[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    event_id: 7,
    image_url: `/api/storage/event_images/events/7/photos/${i + 1}.jpg`,
    caption: null,
    sequence_order: i,
    created_at: "2026-06-21T00:00:00Z",
  }));

function stubFetch({ data = photos(3), eventOk = true }: { data?: EventPhoto[]; eventOk?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/photos")
        ? { ok: true, json: async () => ({ data }) }
        : { ok: eventOk, json: async () => (eventOk ? event : null) },
    ),
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventMemoriesPage", () => {
  it("leads with the photographs, not with the event", async () => {
    stubFetch();

    const { container } = render(<EventMemoriesPage from="community" />);

    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(3));
    expect(screen.getByText("Event memories")).toBeTruthy();
  });

  it("names the event it belongs to, so a memory is identifiable", async () => {
    stubFetch();

    render(<EventMemoriesPage from="community" />);

    expect(await screen.findByRole("heading", { name: "Prompt Engineering Workshop", level: 1 })).toBeTruthy();
    expect(screen.getByText("StartupLab Hub")).toBeTruthy();
  });

  it("offers the event as a link rather than wrapping the photos in it", async () => {
    stubFetch();

    render(<EventMemoriesPage from="community" />);

    const link = await screen.findByRole("link", { name: /View event details/ });
    expect(link.getAttribute("href")).toBe("/events/7?from=community");
  });

  it("returns the reader to where they came from", async () => {
    stubFetch();

    render(<EventMemoriesPage from="community" />);

    const back = await screen.findByRole("link", { name: /Back to Community/ });
    expect(back.getAttribute("href")).toBe("/community");
  });

  it("falls back to the events list when no origin was carried", async () => {
    stubFetch();

    render(<EventMemoriesPage />);

    expect(await screen.findByRole("link", { name: /Back to Events/ })).toBeTruthy();
  });

  it("explains an empty archive rather than rendering a blank page", async () => {
    stubFetch({ data: [] });

    render(<EventMemoriesPage from="community" />);

    // Reachable by a typed or shared URL; the strip only links here when there
    // is an archive to link to.
    expect(await screen.findByText("No photos from this event yet")).toBeTruthy();
  });

  it("says so when the event does not exist", async () => {
    stubFetch({ eventOk: false });

    render(<EventMemoriesPage from="community" />);

    expect(await screen.findByText("This event could not be found.")).toBeTruthy();
  });
});
