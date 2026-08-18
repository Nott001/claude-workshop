// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import StaffOrganizationPage from "@/app/staff/organization/page";

vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useSession } from "@/modules/auth/components/session-context";

const MEMBER = { id: 1, full_name: "Ada Admin", email: "ada@example.com", role: ROLES.ADMIN };
const FACILITATOR = { id: 2, full_name: "Ben Facilitator", email: "ben@example.com", role: ROLES.FACILITATOR };
const ATTENDEE = { id: 3, full_name: "Cara Attendee", email: "cara@example.com", role: ROLES.ATTENDEE };
const SUPER_ADMIN = { id: 4, full_name: "Sam Super", email: "sam@example.com", role: ROLES.SUPER_ADMIN };

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(members: unknown[], total: number) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => ({ users: members, total }) };
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRoleGuard).mockReturnValue({ role: ROLES.SUPER_ADMIN, allowed: true, pending: false });
  vi.mocked(useSession).mockReturnValue({ user: { id: 99 } } as ReturnType<typeof useSession>);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("StaffOrganizationPage", () => {
  it("renders members from the fetch with page and limit", async () => {
    stubFetch([MEMBER, FACILITATOR], 2);

    render(<StaffOrganizationPage />);

    expect(await screen.findByText("Ada Admin")).toBeTruthy();
    expect(screen.getByText("Ben Facilitator")).toBeTruthy();
    expect(screen.getByText("ben@example.com")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/organization?page=1&limit=10");
  });

  it("types in search, fires a fetch with search= after the debounce", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return { ok: true, json: async () => ({ users: [], total: 0 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffOrganizationPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/organization?page=1&limit=10");

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), {
      target: { value: "ada" },
    });

    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/organization?page=1&limit=10&search=ada");
  });

  it("shows the empty state under the column headers when nothing matches", async () => {
    stubFetch([], 0);

    render(<StaffOrganizationPage />);

    expect(await screen.findByText("No members found")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Role")).toBeTruthy();
  });

  it("keeps the rows and shows the unified notice when a refetch fails", async () => {
    vi.useFakeTimers();
    stubFetch([MEMBER], 1);

    render(<StaffOrganizationPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Ada Admin")).toBeTruthy();

    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, json: async () => ({}) }));

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), { target: { value: "ada" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("Failed to refresh members — showing last loaded results.")).toBeTruthy();
    expect(screen.getByText("Ada Admin")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("dims the rows and sets aria-busy while a search refetch is in flight", async () => {
    vi.useFakeTimers();
    let lastResolve: ((value: unknown) => void) | undefined;
    fetchMock = vi.fn(() => new Promise((resolve) => (lastResolve = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    render(<StaffOrganizationPage />);
    await act(async () => {
      lastResolve?.({ ok: true, json: async () => ({ users: [MEMBER], total: 1 }) });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Ada Admin")).toBeTruthy();
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), { target: { value: "ada" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      lastResolve?.({ ok: true, json: async () => ({ users: [MEMBER], total: 1 }) });
    });
    expect(document.querySelector("tbody")?.getAttribute("aria-busy")).toBeNull();
  });

  it("filters by role via the select", async () => {
    stubFetch([], 0);

    render(<StaffOrganizationPage />);
    await screen.findByText("No members found");

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const facilitatorOption = await screen.findByRole("option", { name: "Facilitator" });
      fireEvent.pointerDown(facilitatorOption, { pointerType: "mouse" });
      fireEvent.click(facilitatorOption);
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/organization?page=1&limit=10&role=facilitator");
  });

  it("paginates with page=2", async () => {
    stubFetch([MEMBER], 30);

    render(<StaffOrganizationPage />);
    await screen.findByText("Ada Admin");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/organization?page=2&limit=10"));
  });

  it("opens the drawer on row click showing the member's role", async () => {
    stubFetch([MEMBER], 1);

    render(<StaffOrganizationPage />);
    await screen.findByText("Ada Admin");

    fireEvent.click(screen.getByRole("row", { name: /Manage Ada Admin/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("ada@example.com");
    // Displayed as a label rather than as the enum value stored in the column.
    expect(dialog.textContent).toContain("Admin");
  });

  it("removes a member from the drawer with DELETE and refreshes", async () => {
    stubFetch([MEMBER, FACILITATOR], 2);

    render(<StaffOrganizationPage />);
    await screen.findByText("Ada Admin");

    fireEvent.click(screen.getByRole("row", { name: /Manage Ben Facilitator/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(window.confirm).toHaveBeenCalledWith("Remove this member from the organization?");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/organization/2", { method: "DELETE" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/organization?page=1&limit=10"));
  });

  it("hides Remove for the signed-in user's own row", async () => {
    vi.mocked(useSession).mockReturnValue({ user: { id: 1 } } as ReturnType<typeof useSession>);
    stubFetch([MEMBER], 1);

    render(<StaffOrganizationPage />);
    await screen.findByText("Ada Admin");

    fireEvent.click(screen.getByRole("row", { name: /Manage Ada Admin/ }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("filters to attendees so one can be found to promote", async () => {
    stubFetch([], 0);

    render(<StaffOrganizationPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const attendee = await screen.findByRole("option", { name: "Attendee" });
      fireEvent.pointerDown(attendee, { pointerType: "mouse" });
      fireEvent.click(attendee);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/organization?page=1&limit=10&role=attendee"));
  });

  it("changes a member's role with PATCH and refreshes the list", async () => {
    stubFetch([ATTENDEE], 1);

    render(<StaffOrganizationPage />);
    await screen.findByText("Cara Attendee");

    fireEvent.click(screen.getByRole("row", { name: /Manage Cara Attendee/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox", { name: /Change role/i }));
      const facilitator = await screen.findByRole("option", { name: "Facilitator" });
      fireEvent.pointerDown(facilitator, { pointerType: "mouse" });
      fireEvent.click(facilitator);
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/organization/3", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: ROLES.FACILITATOR }),
      }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/organization?page=1&limit=10"));
  });

  // The route refuses both of these; the drawer must not offer them either, or
  // the only feedback is a failed request.
  it("offers no role change for a super admin", async () => {
    stubFetch([SUPER_ADMIN], 1);

    render(<StaffOrganizationPage />);
    await screen.findByText("Sam Super");

    fireEvent.click(screen.getByRole("row", { name: /Manage Sam Super/ }));

    expect(screen.getByRole("dialog").textContent).toContain("cannot be changed here");
    expect(screen.queryByRole("combobox", { name: /Change role/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("offers no role change for the caller's own row", async () => {
    vi.mocked(useSession).mockReturnValue({ user: { id: 1 } } as ReturnType<typeof useSession>);
    stubFetch([MEMBER], 1);

    render(<StaffOrganizationPage />);
    await screen.findByText("Ada Admin");

    fireEvent.click(screen.getByRole("row", { name: /Manage Ada Admin/ }));

    expect(screen.getByRole("dialog").textContent).toContain("cannot change your own role");
    expect(screen.queryByRole("combobox", { name: /Change role/i })).toBeNull();
  });

  it("keeps admin out of the picker for an admin who is not a super admin", async () => {
    vi.mocked(useRoleGuard).mockReturnValue({ role: ROLES.ADMIN, allowed: true, pending: false });
    stubFetch([ATTENDEE], 1);

    render(<StaffOrganizationPage />);
    await screen.findByText("Cara Attendee");

    fireEvent.click(screen.getByRole("row", { name: /Manage Cara Attendee/ }));
    fireEvent.click(screen.getByRole("combobox", { name: /Change role/i }));

    expect(await screen.findByRole("option", { name: "Facilitator" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Admin" })).toBeNull();
  });
});
