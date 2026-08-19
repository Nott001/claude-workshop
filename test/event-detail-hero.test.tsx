// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { EventDetailHero } from "@/modules/events/components/event-detail-hero";

const baseEvent = {
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  cover_image_url: null,
  venue_name: "Hall A",
  venue_address: "123 Main St",
  status: "active",
} as const;

const renderHero = (props: Partial<Parameters<typeof EventDetailHero>[0]> = {}) =>
  render(<EventDetailHero event={baseEvent} {...props} />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("EventDetailHero", () => {
  it("renders the cover image with the event title as alt", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });

    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/cover.jpg");
    expect(img.getAttribute("alt")).toBe("Launch Day");
  });

  // The card clips its overflow, so percentage tracks did not visibly hang here
  // — they cost the text panel most of its right padding instead, leaving the
  // title against the card edge. Same root cause as the page grid, hidden.
  it("sizes its columns in fr so the gap cannot eat the text panel's padding", () => {
    const { container } = renderHero();

    const grid = container.querySelector(".grid");
    const tracks = [...(grid?.classList ?? [])].find((c) => c.startsWith("lg:grid-cols-"));

    expect(tracks).toBe("lg:grid-cols-[65fr_35fr]");
    expect(tracks).not.toMatch(/%/);
  });

  it("opens the cover in an overlay when the panel is clicked", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });

    fireEvent.click(screen.getByRole("button", { name: "View the cover image for Launch Day" }));

    // Two now: the one in the hero, and the one the overlay shows.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img").getAttribute("src")).toBe("/cover.jpg");
  });

  it("closes the overlay from its own X", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: /View the cover image/ }));

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives that X its own contrast rather than the shared ghost one", () => {
    // The shared close button is drawn in the foreground colour, which over a
    // dark cover is invisible — and which cover gets uploaded is not something
    // this component gets to know.
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: /View the cover image/ }));

    const close = within(screen.getByRole("dialog")).getByRole("button", { name: "Close" });

    expect(close.className).toContain("bg-black/60");
    expect(close.className).toContain("text-white");
  });

  it("shows nothing until it is clicked", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the overlay for assistive tech without drawing over the picture", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });

    fireEvent.click(screen.getByRole("button", { name: /View the cover image/ }));

    expect(within(screen.getByRole("dialog")).getByText("Launch Day").className).toContain("sr-only");
  });

  it("carries the cursor on a real button, so the cover opens from the keyboard too", () => {
    // A div with an onClick would look identical to the pointer and be
    // unreachable without one; the element is what makes Enter and Space work,
    // so that is what this pins rather than a synthesized key event.
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });
    const trigger = screen.getByRole("button", { name: /View the cover image/ });

    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
  });

  it("marks the panel clickable with the cursor and nothing that moves", () => {
    // The affordance the change asked for: a cursor, no hover animation. At
    // this size anything that shifts or recolours reads as a glitch.
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });
    const trigger = screen.getByRole("button", { name: /View the cover image/ });

    expect(trigger.className).toContain("cursor-pointer");
    expect(trigger.className).not.toMatch(/hover:|transition|duration-|animate-/);
  });

  it("leaves the panel inert when there is no cover to enlarge", () => {
    renderHero();

    expect(screen.queryByRole("button", { name: /cover image/i })).toBeNull();
  });

  it("lets a click through the badge, which covers a corner of the panel", () => {
    renderHero({ event: { ...baseEvent, cover_image_url: "/cover.jpg" } });

    expect(screen.getByText("Upcoming").parentElement!.className).toContain("pointer-events-none");
  });

  it("renders the gradient fallback when there is no cover image", () => {
    const { container } = renderHero();

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".from-sky-500")).not.toBeNull();
  });

  it("shows the badge label, title and the formatted date/time facts", () => {
    renderHero();

    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Launch Day" })).toBeTruthy();
    expect(screen.getByText("Sep 1, 2026")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 5:00 PM")).toBeTruthy();
  });

  it("shows a Completed badge for a finished event", () => {
    renderHero({ event: { ...baseEvent, status: "complete", event_date: "2020-01-01" } });

    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.queryByText("Upcoming")).toBeNull();
  });

  it("shows the duration and venue facts derived from the event", () => {
    renderHero();

    expect(screen.getByText("8 hours")).toBeTruthy();
    expect(screen.getByText("Hall A, 123 Main St")).toBeTruthy();
  });

  it("omits the duration when the window is inverted", () => {
    renderHero({ event: { ...baseEvent, start_time: "17:00", end_time: "09:00" } });

    expect(screen.queryByText(/( hours| hr | min\b)/)).toBeNull();
  });

  it("omits the venue fact when the event has no venue", () => {
    renderHero({ event: { ...baseEvent, venue_name: "", venue_address: null } });

    expect(screen.queryByText(/venue/i)).toBeNull();
  });

  it("labels an online event as online rather than as a venue", () => {
    renderHero({ event: { ...baseEvent, event_type: "online", venue_name: "Zoom", venue_address: null } });

    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("Zoom")).toBeTruthy();
    expect(screen.queryByText("Venue")).toBeNull();
  });

  it("still calls an onsite event a venue", () => {
    renderHero({ event: { ...baseEvent, event_type: "onsite" } });

    expect(screen.getByText("Venue")).toBeTruthy();
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("never mentions seats", () => {
    renderHero();

    expect(screen.queryByText(/seat/i)).toBeNull();
  });

  it("leaves the register CTA to the register card", () => {
    renderHero();

    expect(screen.queryByRole("button", { name: /register/i })).toBeNull();
  });

  it("shows the countdown for an upcoming event", () => {
    renderHero({ event: { ...baseEvent, event_date: "2099-01-01" } });

    expect(screen.getByText("Starts in")).toBeTruthy();
  });

  it("hides the countdown once the event has started", () => {
    renderHero({ event: { ...baseEvent, event_date: "2020-01-01" } });

    expect(screen.queryByText("Starts in")).toBeNull();
  });
});
