// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CourseSection } from "@/modules/events/pages/staff-event-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/modules/courses/lib/use-course-by-event", () => ({ useCourseByEvent: vi.fn() }));

import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";

const course = (id: number, name: string, description: string | null) => ({
  id,
  course_name: name,
  course_description: description,
  MODULE: [] as { LESSONS: unknown[] }[],
});

function renderSection(props: Partial<React.ComponentProps<typeof CourseSection>> = {}) {
  return render(<CourseSection eventId="1" userRole={ROLES.FACILITATOR} canManageCourse={true} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
  byEvent.mockReturnValue({ course: null, loading: false, error: null });
});

afterEach(() => {
  cleanup();
});

describe("CourseSection gating", () => {
  it("shows the create button only to someone who can manage the course", () => {
    renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: true });

    expect(screen.getByText("No course yet for this event.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Course" })).toBeTruthy();

    cleanup();
    const { container } = renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: false });

    expect(screen.queryByRole("button", { name: "Create Course" })).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("gives managers Manage Course and Enter Course Room once a course exists", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: course(1, "Intro to Cloudflare", null),
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    expect(screen.getByText("Intro to Cloudflare")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Course" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter Course Room" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Course" })).toBeNull();
  });

  it("navigates to the staff course page from Manage Course", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: course(1, "Intro to Cloudflare", null),
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    fireEvent.click(screen.getByRole("button", { name: "Manage Course" }));
    expect(push).toHaveBeenCalledWith("/staff/events/1/course");
  });

  it("navigates to the course room from Enter Course Room", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: course(1, "Intro to Cloudflare", null),
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    fireEvent.click(screen.getByRole("button", { name: "Enter Course Room" }));
    expect(push).toHaveBeenCalledWith("/courses/1/room");
  });

  it("navigates to the staff course page from Create Course", () => {
    renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: true });

    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));
    expect(push).toHaveBeenCalledWith("/staff/events/1/course");
  });

  it("renders the course summary with no buttons for a non-manager staff member", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: course(1, "Intro to Cloudflare", null),
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: false });

    expect(screen.getByText("Intro to Cloudflare")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage Course" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enter Course Room" })).toBeNull();
  });

  it("renders nothing for a non-staff member without access", () => {
    const { container } = renderSection({ userRole: ROLES.ATTENDEE, canManageCourse: false });

    expect(container.firstChild).toBeNull();
  });

  it("shows the waiting state for staff who are not assigned", () => {
    renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: false });

    expect(screen.getByText("Waiting for the speaker to create a course for this event.")).toBeTruthy();
  });
});
