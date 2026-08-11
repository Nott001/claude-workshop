// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
    label: "WhatsApp",
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommunityListPage", () => {
  it("renders every card the API returns", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => cards }));

    render(<CommunityListPage />);

    expect(await screen.findByText("StartupLab Facebook")).toBeTruthy();
    expect(screen.getByText("WhatsApp")).toBeTruthy();
    expect(screen.getByText("The main discussion group.")).toBeTruthy();
  });

  it("links each card out in a new tab, never in the same one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => cards }));

    render(<CommunityListPage />);

    const facebook = await screen.findByRole("link", { name: /StartupLab Facebook/ });
    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });

    expect(facebook.getAttribute("href")).toBe("https://facebook.com/groups/startuplab");
    expect(facebook.getAttribute("target")).toBe("_blank");
    expect(facebook.getAttribute("rel")).toBe("noopener noreferrer");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows an empty state when no visible cards exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    render(<CommunityListPage />);

    expect(await screen.findByText("No community groups yet. Check back soon.")).toBeTruthy();
  });

  it("shows a failure message when the API rejects the anonymous call", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<CommunityListPage />);

    expect(await screen.findByText("Failed to load community groups.")).toBeTruthy();
  });
});
