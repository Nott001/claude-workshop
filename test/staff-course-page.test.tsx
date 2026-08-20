// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import StaffEventCoursePage from "@/app/staff/events/[id]/course/page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "1" }), useRouter: () => ({ push, replace }) }));
vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));
vi.mock("@/modules/courses/lib/use-course-by-event", () => ({ useCourseByEvent: vi.fn() }));
vi.mock("@/modules/events/lib/use-assigned-speakers", () => ({ useAssignedSpeakers: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";

function resolveById() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 1, start_time: "09:00", end_time: "17:00" }),
  });
}

function rejectById() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: "Not found" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (useRoleGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    pending: false,
    allowed: true,
    role: ROLES.FACILITATOR,
  });
  (useCourseByEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    course: null,
    loading: false,
    error: null,
  });
  (useAssignedSpeakers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    speakers: [],
    loading: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

describe("StaffEventCoursePage", () => {
  it("renders the curriculum builder when the event loads", async () => {
    resolveById();

    render(<StaffEventCoursePage />);

    expect(await screen.findByText("Manage Course")).toBeTruthy();
    expect(screen.getByText("Back to event")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to event/ }).getAttribute("href")).toBe("/staff/events/1");
  });

  it("redirects to /staff/events when the event API returns non-ok", async () => {
    rejectById();

    render(<StaffEventCoursePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/events"));
  });

  it("redirects when the role guard denies access", () => {
    (useRoleGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      pending: false,
      allowed: false,
      role: ROLES.ATTENDEE,
    });

    render(<StaffEventCoursePage />);

    expect(replace).toHaveBeenCalledWith("/staff/events");
  });

  it("shows a loading state while the session is pending", () => {
    (useRoleGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      pending: true,
      allowed: false,
      role: null,
    });

    render(<StaffEventCoursePage />);

    expect(screen.getByLabelText("Loading page")).toBeTruthy();
    expect(screen.queryByText("Loading...")).toBeNull();
  });
});
