// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

import { EventGalleryPreview } from "@/modules/events/components/event-gallery-preview";
import type { EventPhoto } from "@/shared/types";

const photos = (count: number): EventPhoto[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    event_id: 7,
    image_url: `/api/storage/event_images/events/7/photos/${i + 1}.jpg`,
    caption: null,
    sequence_order: i,
    created_at: "2026-05-01T00:00:00Z",
  }));

function stubPhotos(data: EventPhoto[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ data }) })),
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventGalleryPreview", () => {
  it("still shows the section when the archive is empty", async () => {
    stubPhotos([]);

    render(<EventGalleryPreview eventId="7" />);

    // A section that vanishes leaves the reader unable to tell "no photos yet"
    // from "this event never had any".
    expect(await screen.findByRole("heading", { name: "Photos" })).toBeTruthy();
    expect(screen.getByText("No photos from this event yet.")).toBeTruthy();
  });

  it("offers no link into an empty archive", async () => {
    stubPhotos([]);

    render(<EventGalleryPreview eventId="7" />);

    await screen.findByRole("heading", { name: "Photos" });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says nothing at all while the archive is still loading", () => {
    // Never resolves, so the component stays in its loading state.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    const { container } = render(<EventGalleryPreview eventId="7" />);

    // Rendering the empty state first would tell every reader "no photos" for
    // the length of a request, then contradict itself.
    expect(container.innerHTML).toBe("");
  });

  it("shows a strip rather than the whole gallery", async () => {
    stubPhotos(photos(9));

    const { container } = render(<EventGalleryPreview eventId="7" />);

    // The archive has its own page; rendering every photo in both places is one
    // set of pictures maintained as two surfaces.
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(4));
  });

  it("links through to the archive, carrying the origin it was opened from", async () => {
    stubPhotos(photos(9));

    render(<EventGalleryPreview eventId="7" backOrigin="community" />);

    const link = await screen.findByRole("link", { name: /View all 9/ });
    expect(link.getAttribute("href")).toBe("/events/7/memories?from=community");
  });

  it("counts the overflow onto the last tile", async () => {
    stubPhotos(photos(9));

    render(<EventGalleryPreview eventId="7" />);

    // On the last tile rather than in a fifth one, so the strip keeps its shape
    // whether or not anything overflows.
    expect(await screen.findByText("+5")).toBeTruthy();
  });

  it("shows no overflow badge when the strip holds everything", async () => {
    stubPhotos(photos(3));

    render(<EventGalleryPreview eventId="7" />);

    await screen.findByRole("link", { name: /View all 3/ });
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("omits the origin when it was opened without one", async () => {
    stubPhotos(photos(2));

    render(<EventGalleryPreview eventId="7" />);

    const link = await screen.findByRole("link", { name: /View all 2/ });
    expect(link.getAttribute("href")).toBe("/events/7/memories");
  });
});
