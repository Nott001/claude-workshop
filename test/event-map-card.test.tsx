// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EventMapCard } from "@/modules/events/components/event-map-card";

afterEach(cleanup);

const VENUE = { venue_name: "Hall A", venue_address: "123 Main St" };
const EMBED_SRC = "https://www.google.com/maps?q=Hall%20A%2C%20123%20Main%20St&output=embed";

describe("EventMapCard", () => {
  it("names the address and previews it on a map", () => {
    const { container } = render(<EventMapCard event={VENUE} />);

    expect(screen.getByRole("heading", { name: /address/i })).toBeTruthy();
    expect(screen.getByText("Hall A, 123 Main St")).toBeTruthy();
    expect(container.querySelector("iframe")!.getAttribute("src")).toBe(EMBED_SRC);
  });

  it("never hands the reader off to another tab", () => {
    const { container } = render(<EventMapCard event={VENUE} />);

    // The map stays on this page now, so nothing in the card navigates away.
    expect(container.querySelector("[target='_blank']")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });

  it("keeps the preview inert so its own clicks cannot leave the site", () => {
    const { container } = render(<EventMapCard event={VENUE} />);
    const preview = container.querySelector("iframe")!;

    // Google's frame carries its own links; without this they are clickable
    // and reachable by Tab, from inside a button that is the real control.
    expect(preview.className).toContain("pointer-events-none");
    expect(preview.getAttribute("tabindex")).toBe("-1");
    expect(preview.getAttribute("aria-hidden")).toBe("true");
  });

  it("opens the map in an overlay when the preview is clicked", () => {
    const { container } = render(<EventMapCard event={VENUE} />);

    expect(screen.queryByTitle("Map of Hall A, 123 Main St")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /open a larger map/i }));

    const dialogMap = screen.getByTitle("Map of Hall A, 123 Main St");
    expect(dialogMap.getAttribute("src")).toBe(EMBED_SRC);
    // The overlay's map is the usable one: pannable, and not hidden from
    // assistive tech the way the preview behind it is.
    expect(dialogMap.className).not.toContain("pointer-events-none");
    expect(container).toBeTruthy();
  });

  it("opens the same overlay from the button under the preview", () => {
    render(<EventMapCard event={VENUE} />);

    fireEvent.click(screen.getByRole("button", { name: /view larger map/i }));

    expect(screen.getByTitle("Map of Hall A, 123 Main St")).toBeTruthy();
  });

  it("closes the overlay again", () => {
    render(<EventMapCard event={VENUE} />);
    fireEvent.click(screen.getByRole("button", { name: /view larger map/i }));

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByTitle("Map of Hall A, 123 Main St")).toBeNull();
  });

  it("carries the address the register card used to list", () => {
    render(<EventMapCard event={{ venue_name: "Hall A", venue_address: null }} />);

    expect(screen.getByText("Hall A")).toBeTruthy();
  });

  it("renders nothing when the venue is empty", () => {
    const { container } = render(<EventMapCard event={{ venue_name: null, venue_address: null }} />);

    expect(container.firstChild).toBeNull();
  });
});
