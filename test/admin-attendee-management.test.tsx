// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { AdminAttendeeManagement } from "@/modules/events/components/admin-attendee-management";

const attendee = {
  user_id: 1,
  full_name: "Rina Dela Cruz",
  email: "rina@example.com",
  ticket_status: "issued" as const,
  issued_at: "2026-08-01T09:00:00.000Z",
  checked_in_at: null,
  survey: { sent: true, responded: false },
  can_check_in: true,
  can_cancel: true,
  can_resend_ticket: true,
  can_send_survey: true,
};

const checkedInAttendee = {
  ...attendee,
  user_id: 2,
  full_name: "Jose Santos",
  email: "jose@example.com",
  ticket_status: "checked_in" as const,
  checked_in_at: "2026-08-14T10:00:00.000Z",
  survey: null,
  can_check_in: false,
  can_cancel: false,
  can_resend_ticket: false,
  can_send_survey: false,
};

const noPermissionsAttendee = {
  ...attendee,
  user_id: 3,
  full_name: "No Perms",
  email: "noperms@example.com",
  can_check_in: false,
  can_cancel: false,
  can_resend_ticket: false,
  can_send_survey: false,
};

function manageResponse(attendees: unknown[], surveySendable: boolean) {
  return {
    ok: true,
    json: async () => ({ attendees, total: attendees.length, page: 1, limit: 15, survey_sendable: surveySendable }),
  };
}

const postOk = { ok: true, json: async () => ({}) };

let fetchMock: ReturnType<typeof vi.fn>;
let list: unknown[];
let surveySendable: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  list = [attendee];
  surveySendable = true;
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Promise.resolve(postOk);
    return Promise.resolve(manageResponse(list, surveySendable));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("AdminAttendeeManagement", () => {
  it("renders registered users with status, survey and attendee columns but no in-row actions", async () => {
    list = [attendee, checkedInAttendee];

    render(<AdminAttendeeManagement eventId="7" />);

    expect(await screen.findByText("Rina Dela Cruz")).toBeTruthy();
    expect(screen.getByText("jose@example.com")).toBeTruthy();
    expect(screen.getByText("Registered")).toBeTruthy();
    expect(screen.getByText(/Checked in ·/)).toBeTruthy();
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.queryByText("Check in")).toBeNull();
    expect(screen.queryByText("Cancel")).toBeNull();
    expect(screen.queryByText("Send survey")).toBeNull();
    expect(screen.queryByText("Resend ticket")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/events/7/attendees/manage?page=1&limit=15");
  });

  it("warns when survey sends are unavailable and stays quiet when they are", async () => {
    surveySendable = false;
    const { unmount } = render(<AdminAttendeeManagement eventId="7" />);

    expect(await screen.findByText(/Survey sends are unavailable/)).toBeTruthy();
    unmount();

    surveySendable = true;
    render(<AdminAttendeeManagement eventId="7" />);
    expect(await screen.findByText("Rina Dela Cruz")).toBeTruthy();
    expect(screen.queryByText(/Survey sends are unavailable/)).toBeNull();
  });

  it("shows the empty state when nothing matches", async () => {
    list = [];

    render(<AdminAttendeeManagement eventId="7" />);

    expect(await screen.findByText("No attendees found")).toBeTruthy();
  });

  it("surfaces a failed load", async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, json: async () => ({}) }));

    render(<AdminAttendeeManagement eventId="7" />);

    expect(await screen.findByText("Failed to load attendees")).toBeTruthy();
  });

  it("refetches when the search term or status filter changes", async () => {
    render(<AdminAttendeeManagement eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fireEvent.change(screen.getByPlaceholderText("Search name or email..."), {
      target: { value: "rina" },
    });
    await act(async () => {});
    expect(fetchMock).toHaveBeenLastCalledWith("/api/events/7/attendees/manage?page=1&limit=15&search=rina");

    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
      const checkedInOption = await screen.findByRole("option", { name: "Checked in" });
      fireEvent.pointerDown(checkedInOption, { pointerType: "mouse" });
      fireEvent.click(checkedInOption);
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/events/7/attendees/manage?page=1&limit=15&search=rina&status=checked_in");
  });

  it("opens the drawer on row click with details and actions", async () => {
    render(<AdminAttendeeManagement eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fireEvent.click(screen.getByRole("row", { name: /Manage Rina Dela Cruz/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("rina@example.com");
    expect(dialog.textContent).toContain("Aug 1, 2026");
    expect(screen.getByRole("button", { name: "Check in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send survey" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend ticket" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("checks an attendee in from the drawer by POSTing and refreshing the list", async () => {
    render(<AdminAttendeeManagement eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fireEvent.click(screen.getByRole("row", { name: /Manage Rina Dela Cruz/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events/7/attendees/1/checkin", { method: "POST" }));
  });

  it("cancels a registration from the drawer only after confirmation", async () => {
    render(<AdminAttendeeManagement eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fireEvent.click(screen.getByRole("row", { name: /Manage Rina Dela Cruz/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(window.confirm).toHaveBeenCalledWith("Cancel Rina Dela Cruz's registration? This cannot be undone.");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events/7/attendees/1/cancel", { method: "POST" }));
  });

  it("shows the API error message when an action fails", async () => {
    render(<AdminAttendeeManagement eventId="7" />);
    await screen.findByText("Rina Dela Cruz");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve({ ok: false, json: async () => ({ error: "Ticket already cancelled" }) });
      }
      return Promise.resolve(manageResponse(list, surveySendable));
    });

    fireEvent.click(screen.getByRole("row", { name: /Manage Rina Dela Cruz/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send survey" }));
    });

    expect(await screen.findByText("Ticket already cancelled")).toBeTruthy();
  });

  it("shows the drawer with no action buttons when the attendee has no permissions", async () => {
    list = [noPermissionsAttendee];

    render(<AdminAttendeeManagement eventId="7" />);
    await screen.findByText("No Perms");

    fireEvent.click(screen.getByRole("row", { name: /Manage No Perms/ }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send survey" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resend ticket" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});
