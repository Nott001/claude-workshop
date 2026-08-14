// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { CommunityListPage } from "@/modules/community/pages/community-list";

const cards = [
  {
    id: 1,
    label: "StartupLab Facebook",
    url: "https://facebook.com/groups/startuplab",
    description: "The main discussion group.",
    icon_url: null,
    sequence_order: 1,
    is_hidden: false,
    created_by: 9,
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
  },
  {
    id: 2,
    label: "Workshop Participants",
    url: "https://chat.whatsapp.com/abc",
    description: null,
    icon_url: null,
    sequence_order: 2,
    is_hidden: false,
    created_by: 9,
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
  },
];

const pastEvents = [
  {
    id: 7,
    title: "Prompt Engineering Workshop",
    event_date: "2026-06-21",
    venue_name: "StartupLab Hub",
    COURSE: { course_name: "AI Workshop" },
  },
];

/**
 * The page reads two endpoints. Routing by URL rather than stubbing one blanket
 * response keeps a failure on one section from silently standing in for the
 * other — the community groups error test depends on events still resolving.
 */
function stubFetch(overrides: { links?: unknown; linksOk?: boolean; events?: unknown } = {}) {
  const fetchMock = vi.fn(async (input: string) => {
    if (input.startsWith("/api/events")) {
      return { ok: true, json: async () => ({ data: overrides.events ?? [] }) };
    }
    return { ok: overrides.linksOk ?? true, json: async () => overrides.links ?? cards };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommunityListPage", () => {
  it("renders every card the API returns", async () => {
    stubFetch();

    render(<CommunityListPage />);

    expect(await screen.findByText("StartupLab Facebook")).toBeTruthy();
    expect(screen.getByText("Workshop Participants")).toBeTruthy();
    expect(screen.getByText("The main discussion group.")).toBeTruthy();
  });

  it("keeps each card's join link pointed out of the app in a new tab", async () => {
    stubFetch();

    render(<CommunityListPage />);

    const facebook = await screen.findByRole("link", { name: "Join StartupLab Facebook" });
    const whatsapp = screen.getByRole("link", { name: "Join Workshop Participants" });

    expect(facebook.getAttribute("href")).toBe("https://facebook.com/groups/startuplab");
    expect(facebook.getAttribute("target")).toBe("_blank");
    expect(facebook.getAttribute("rel")).toBe("noopener noreferrer");
    expect(whatsapp.getAttribute("href")).toBe("https://chat.whatsapp.com/abc");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("confirms before handing the visitor off, naming the platform and the group", async () => {
    stubFetch();

    render(<CommunityListPage />);

    fireEvent.click(await screen.findByRole("link", { name: "Join StartupLab Facebook" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Facebook");
    expect(dialog.textContent).toContain("StartupLab Facebook");

    const cont = screen.getByRole("link", { name: /Continue/ });
    expect(cont.getAttribute("href")).toBe("https://facebook.com/groups/startuplab");
    expect(cont.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not open the confirmation until a card is clicked", async () => {
    stubFetch();

    render(<CommunityListPage />);
    await screen.findByText("StartupLab Facebook");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the visitor back out of the hand-off", async () => {
    stubFetch();

    render(<CommunityListPage />);

    fireEvent.click(await screen.findByRole("link", { name: "Join Workshop Participants" }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Stay here" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("labels each card with the platform its link points at", async () => {
    stubFetch();

    render(<CommunityListPage />);

    expect(await screen.findByText("Facebook")).toBeTruthy();
    expect(screen.getByText("WhatsApp")).toBeTruthy();
  });

  it("keeps the hero on screen while the cards are still loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<CommunityListPage />);

    expect(screen.getByRole("heading", { name: "Connect, Share & Learn Together" })).toBeTruthy();
    expect(screen.getByText("Loading community...")).toBeTruthy();
  });

  it("shows an empty state when no visible cards exist", async () => {
    stubFetch({ links: [] });

    render(<CommunityListPage />);

    expect(await screen.findByText("No community groups yet. Check back soon.")).toBeTruthy();
  });

  it("shows a failure message when the API rejects the anonymous call", async () => {
    stubFetch({ linksOk: false });

    render(<CommunityListPage />);

    expect(await screen.findByText("Failed to load community groups.")).toBeTruthy();
  });

  it("lists events that have already finished, linking each back to its detail page", async () => {
    stubFetch({ events: pastEvents });

    render(<CommunityListPage />);

    const memory = await screen.findByRole("link", { name: /Prompt Engineering Workshop/ });
    // Tagged with the origin so the detail page's back link returns here.
    expect(memory.getAttribute("href")).toBe("/events/7?from=community");
    expect(screen.getByText("AI Workshop")).toBeTruthy();
    expect(screen.getByText("StartupLab Hub")).toBeTruthy();
  });

  it("asks the events API only for past events", async () => {
    const fetchMock = stubFetch({ events: pastEvents });

    render(<CommunityListPage />);
    await screen.findByRole("heading", { name: "Event Memories" });

    const eventCall = fetchMock.mock.calls.map(([url]) => url as string).find((url) => url.startsWith("/api/events"));
    expect(eventCall).toContain("filter=past");
  });

  it("hides the memories section entirely when no event has finished yet", async () => {
    stubFetch({ events: [] });

    render(<CommunityListPage />);
    await screen.findByText("StartupLab Facebook");

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Event Memories" })).toBeNull());
  });
});
