// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { EventGallery } from "@/modules/events/components/event-gallery";
import type { EventPhoto } from "@/shared/types";

afterEach(cleanup);

const photos = (count: number, caption: string | null = null): EventPhoto[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    event_id: 7,
    image_url: `/api/storage/event_images/events/7/photos/${i + 1}.jpg`,
    caption,
    sequence_order: i,
    created_at: "2026-05-01T00:00:00Z",
  }));

const openFirst = () => fireEvent.click(screen.getAllByRole("button")[0]);

describe("EventGallery", () => {
  it("renders nothing at all for an event with no archive", () => {
    const { container } = render(<EventGallery photos={[]} />);

    // Not an empty state: a "no photos" panel on every unphotographed event is
    // a promise the page cannot keep.
    expect(container.innerHTML).toBe("");
  });

  it("counts the archive in its own heading", () => {
    render(<EventGallery photos={photos(3)} />);

    expect(screen.getByText("3 photos from this event.")).toBeTruthy();
  });

  it("says photo, singular, for one", () => {
    render(<EventGallery photos={photos(1)} />);

    expect(screen.getByText("1 photo from this event.")).toBeTruthy();
  });

  it("opens a photo into a modal viewer", () => {
    render(<EventGallery photos={photos(2)} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    openFirst();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("steps forward with the arrow key a reader reaches for", () => {
    render(<EventGallery photos={photos(3)} />);
    openFirst();

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("wraps from the last photo back to the first", () => {
    render(<EventGallery photos={photos(2)} />);
    openFirst();

    fireEvent.keyDown(window, { key: "ArrowLeft" });

    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("closes on Escape", () => {
    render(<EventGallery photos={photos(2)} />);
    openFirst();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives the page its scrolling back when the viewer closes", () => {
    render(<EventGallery photos={photos(2)} />);

    openFirst();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("offers no paging controls for a single photo", () => {
    render(<EventGallery photos={photos(1)} />);
    openFirst();

    expect(screen.queryByLabelText("Next photo")).toBeNull();
  });

  it("shows a caption under the photo it belongs to", () => {
    render(<EventGallery photos={photos(1, "Opening keynote")} />);
    openFirst();

    expect(screen.getByText("Opening keynote")).toBeTruthy();
  });

  it("names the photo for a screen reader from its caption", () => {
    render(<EventGallery photos={photos(1, "Opening keynote")} />);

    expect(screen.getByAltText("Opening keynote")).toBeTruthy();
  });

  it("moves focus into the viewer and gives it back on close", () => {
    render(<EventGallery photos={photos(2)} />);
    const thumbnail = screen.getAllByRole("button")[0];

    fireEvent.click(thumbnail);
    // Without this a keyboard reader stands on the thumbnail behind a
    // full-screen dialog, and Tab walks the page underneath it.
    expect(document.activeElement).toBe(screen.getByLabelText("Close"));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(thumbnail);
  });
});
