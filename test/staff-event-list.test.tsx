// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { StaffEventListPage } from "@/modules/events/pages/staff-event-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));

import { useSession } from "@/modules/auth/components/session-context";

beforeEach(() => {
  vi.clearAllMocks();
  const useSessionMock = useSession as unknown as ReturnType<typeof vi.fn>;
  useSessionMock.mockReturnValue({
    user: { id: 1, role: ROLES.ADMIN, full_name: "Ada", email: "ada@example.com", profile_image_url: null },
    loading: false,
    isSignedIn: true,
    signOut: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], total: 0, page: 1, limit: 50 }) }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("StaffEventListPage", () => {
  it("shows the header and a Create Event button, since the nav entry is gone", async () => {
    render(<StaffEventListPage />);

    expect(await screen.findByRole("heading", { name: "Events" })).toBeTruthy();
    const createLink = screen.getByRole("link", { name: /Create Event/ });
    expect(createLink.getAttribute("href")).toBe("/staff/events/new");
  });

  it("renders a search input and drives the fetch server-side after the debounce", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return { ok: true, json: async () => ({ data: [], total: 0, page: 1, limit: 50 }) };
      }),
    );

    render(<StaffEventListPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50");

    fireEvent.change(screen.getByRole("textbox", { name: "Search events" }), {
      target: { value: "workshop" },
    });

    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50&search=workshop");
  });
});
