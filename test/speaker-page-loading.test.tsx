// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { useSpeakerEvents, useSpeakerEvent, useParams } = vi.hoisted(() => ({
  useSpeakerEvents: vi.fn(),
  useSpeakerEvent: vi.fn(),
  useParams: vi.fn(() => ({ eventId: "4" })),
}));
vi.mock("@/modules/events/lib/use-speaker-events", () => ({ useSpeakerEvents }));
vi.mock("@/modules/events/lib/use-speaker-event", () => ({ useSpeakerEvent }));
vi.mock("next/navigation", () => ({ useParams, useRouter: () => ({ push: vi.fn() }) }));

import { SpeakerEventListPage } from "@/modules/events/pages/speaker-event-list";
import { SpeakerEventDetailPage } from "@/modules/events/pages/speaker-event-detail";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

// These two were the worst loads in the app: a centred line of text under the
// speaker rail, replaced by a page the better part of a thousand pixels taller.
// 0.357 and 0.359 of layout shift, more than three times the budget.
describe("speaker pages while their data loads", () => {
  it("holds the engagement grid's shape instead of centring a line", () => {
    useSpeakerEvents.mockReturnValue({
      events: [],
      loading: true,
      error: null,
      activeTab: "upcoming",
      setActiveTab: vi.fn(),
      upcoming: { events: [], loading: true },
    });

    const { container } = render(<SpeakerEventListPage />);

    expect(screen.queryByText("Loading engagements...")).toBeNull();
    // The grid it loads into is the same one the attendee list draws, so it
    // reserves height with that skeleton rather than a second copy of it.
    expect(screen.getByLabelText("Loading events")).toBeTruthy();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(6);
  });

  it("holds the detail page's twelve-column shape, hero included", () => {
    useSpeakerEvent.mockReturnValue({
      event: null,
      loading: true,
      error: null,
      badge: null,
      isLive: false,
      isUpcoming: false,
      isComplete: false,
    });

    const { container } = render(<SpeakerEventDetailPage />);

    expect(screen.getByLabelText("Loading event details")).toBeTruthy();
    expect(screen.queryByText("Loading event details...")).toBeNull();
    expect(container.querySelector('[class*="grid-cols-12"]')).not.toBeNull();
    // The hero card is the tallest thing on the page and most of its height.
    expect(container.querySelector('[class*="h-[400px]"]')).not.toBeNull();
  });
});
