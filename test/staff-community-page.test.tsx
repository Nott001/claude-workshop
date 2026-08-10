// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import { StaffCommunityListPage } from "@/modules/community/pages/staff-community-list";

vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";

const card = (overrides: Record<string, unknown>) => ({
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
  ...overrides,
});

const GROUP_A = card({ id: 1, label: "Alpha", url: "https://example.com/a", sequence_order: 1 });
const GROUP_B = card({ id: 2, label: "Beta", url: "https://example.com/b", sequence_order: 2 });

let serverCards: Array<ReturnType<typeof card>>;
let requests: Array<{ method: string; url: string; body: unknown }>;

function installFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, url, body });

    if (method === "GET") {
      return { ok: true, json: async () => [...serverCards] };
    }
    if (method === "POST") {
      const created = card({ id: serverCards.length + 1, ...body });
      serverCards.push(created);
      return { ok: true, json: async () => created };
    }
    const match = url.match(/\/api\/community\/(\d+)/);
    const id = Number(match?.[1]);
    if (method === "PATCH") {
      const index = serverCards.findIndex((c) => c.id === id);
      serverCards[index] = { ...serverCards[index], ...body };
      return { ok: true, json: async () => serverCards[index] };
    }
    if (method === "DELETE") {
      serverCards = serverCards.filter((c) => c.id !== id);
      return { ok: true, json: async () => ({ success: true }) };
    }
    return { ok: false, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAsAdmin() {
  const guardMock = useRoleGuard as unknown as ReturnType<typeof vi.fn>;
  guardMock.mockReturnValue({ allowed: true, pending: false, role: ROLES.ADMIN });
  return render(<StaffCommunityListPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  serverCards = [GROUP_A, GROUP_B];
  requests = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StaffCommunityListPage", () => {
  it("renders every card, hidden ones flagged", async () => {
    serverCards = [GROUP_A, card({ id: 2, label: "Beta", is_hidden: true, sequence_order: 2 })];
    installFetch();
    renderAsAdmin();

    expect(await screen.findByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getAllByText("Hidden").length).toBe(1);
  });

  it("hides the whole page from a non-admin", async () => {
    installFetch();
    const guardMock = useRoleGuard as unknown as ReturnType<typeof vi.fn>;
    guardMock.mockReturnValue({ allowed: false, pending: false, role: ROLES.ATTENDEE });

    const { container } = render(<StaffCommunityListPage />);

    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("swaps sequence_order with a neighbor when the up arrow is pressed", async () => {
    installFetch();
    renderAsAdmin();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Move Beta up" }));

    await waitFor(() => {
      expect(requests).toContainEqual(
        expect.objectContaining({ method: "PATCH", url: "/api/community/2", body: { sequence_order: 1 } }),
      );
      expect(requests).toContainEqual(
        expect.objectContaining({ method: "PATCH", url: "/api/community/1", body: { sequence_order: 2 } }),
      );
    });
  });

  it("does not move the first card up", async () => {
    installFetch();
    renderAsAdmin();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "Move Alpha up" }));

    expect(requests.some((r) => r.method === "PATCH")).toBe(false);
  });

  it("toggles a card hidden", async () => {
    installFetch();
    renderAsAdmin();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getAllByRole("button", { name: /Hide/ })[0]);

    await waitFor(() => {
      expect(requests).toContainEqual(
        expect.objectContaining({ method: "PATCH", url: "/api/community/1", body: { is_hidden: true } }),
      );
    });
  });

  it("deletes a card after confirmation", async () => {
    installFetch();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAsAdmin();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getAllByRole("button", { name: /Delete/ })[0]);

    await waitFor(() => {
      expect(requests).toContainEqual(expect.objectContaining({ method: "DELETE", url: "/api/community/1" }));
    });
  });

  it("creates a card through the form and refetches", async () => {
    installFetch();
    renderAsAdmin();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: /Add group/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Discord" } });
    fireEvent.change(screen.getByLabelText("Group URL"), { target: { value: "https://discord.gg/startuplab" } });
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));

    await waitFor(() => {
      expect(requests).toContainEqual(
        expect.objectContaining({
          method: "POST",
          url: "/api/community",
          body: expect.objectContaining({ label: "Discord", url: "https://discord.gg/startuplab" }),
        }),
      );
    });
  });

  it("edits a card inline and saves the changes", async () => {
    installFetch();
    renderAsAdmin();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getAllByRole("button", { name: /Edit/ })[0]);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alpha renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(requests).toContainEqual(
        expect.objectContaining({
          method: "PATCH",
          url: "/api/community/1",
          body: expect.objectContaining({ label: "Alpha renamed" }),
        }),
      );
    });
  });
});
