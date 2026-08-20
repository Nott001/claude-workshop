// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { SpeakerEventListPage } from "@/modules/events/pages/speaker-event-list";
import { parseEventDateTime } from "@/shared/lib/date-utils";

const liveTalk = {
  event_id: 12,
  title: "Live Talk",
  event_date: "2026-08-12",
  start_time: "14:00",
  end_time: "17:00",
  venue_name: "Hall A",
  status: "active",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
};
const keynote = {
  event_id: 11,
  title: "Keynote",
  event_date: "2026-08-20",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Hall B",
  status: "active",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
};
const pastTalk = {
  event_id: 13,
  title: "Past Talk",
  event_date: "2026-08-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Hall C",
  // A past engagement is served with its effective status, so the card renders
  // the Completed badge instead of the Upcoming the stale status column alone
  // would have shown.
  status: "complete",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
};
const draftTalk = {
  event_id: 14,
  title: "WIP Draft",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Hall D",
  status: "draft",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
};

type BucketRows = Array<{
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  event_type: string;
  course_name: null;
  cover_image_url: null;
}>;
// The "fail" sentinel makes the stub answer a failed fetch so the page's
// no-rows error branch is exercised without mocking the fetch rejection.
type BucketValue = BucketRows | "fail";

const defaultBuckets: Record<"upcoming" | "completed" | "drafts", BucketValue> = {
  upcoming: [liveTalk, keynote],
  completed: [pastTalk],
  drafts: [draftTalk],
};

const urls: string[] = [];

function stubBuckets(buckets: Partial<typeof defaultBuckets> = {}) {
  const next = { ...defaultBuckets, ...buckets };
  urls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      urls.push(url);
      const filter = url.split("filter=")[1] as keyof typeof defaultBuckets;
      if (next[filter] === "fail") return { ok: false, json: async () => [] };
      return { ok: true, json: async () => next[filter] ?? [] };
    }),
  );
}

beforeEach(() => {
  vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);
  stubBuckets();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SpeakerEventListPage", () => {
  it("fetches the upcoming bucket on mount and links each card to its detail page", async () => {
    render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Keynote")).toBeTruthy());
    expect(urls[0]).toBe("/api/speakers/me/events?filter=upcoming");

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/speaker/events/11");
    expect(hrefs).toContain("/speaker/events/12");
  });

  it("drives the featured card from a live upcoming event, above the tabs", async () => {
    const { container } = render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Happening now")).toBeTruthy());
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);

    const featuredLink = container.querySelector('a[href="/speaker/events/12"]');
    const tablist = container.querySelector('[role="tablist"]');
    const following = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(featuredLink && tablist && following(featuredLink, tablist)).toBe(true);
  });

  it("keeps a past engagement out of the upcoming grid and files it under Finished", async () => {
    render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Keynote")).toBeTruthy());
    expect(screen.queryByText("Past Talk")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Finished" }));

    expect(await screen.findByText("Past Talk")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("fetches the finished bucket on first visit and keeps the featured card on screen", async () => {
    render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Keynote")).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Finished" }));

    await screen.findByText("Past Talk");
    expect(urls).toContain("/api/speakers/me/events?filter=completed");
    expect(screen.getByText("Happening now")).toBeTruthy();
  });

  it("renders drafts when the Drafts tab is clicked", async () => {
    render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Keynote")).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Drafts" }));

    expect(await screen.findByText("WIP Draft")).toBeTruthy();
    expect(urls).toContain("/api/speakers/me/events?filter=drafts");
  });

  it("shows the per-tab empty message for a bucket with no rows", async () => {
    stubBuckets({ drafts: [] });
    render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Keynote")).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Drafts" }));

    expect(await screen.findByText("No draft engagements.")).toBeTruthy();
    expect(screen.queryByText("No upcoming engagements.")).toBeNull();
  });

  it("shows the error, not a card grid, when a fetched tab comes back with no rows", async () => {
    stubBuckets({ completed: "fail" });
    render(<SpeakerEventListPage />);

    await waitFor(() => expect(screen.getByText("Keynote")).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Finished" }));

    expect(await screen.findByText("Failed to load events")).toBeTruthy();
    expect(screen.queryByText("Past Talk")).toBeNull();
  });
});
