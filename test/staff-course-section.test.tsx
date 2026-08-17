// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventCoursePanel } from "@/modules/events/components/event-course-panel";

vi.mock("@/modules/courses/lib/use-course-by-event", () => ({ useCourseByEvent: vi.fn() }));

import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";

const course = (id: number, name: string, description: string | null) => ({
  id,
  course_name: name,
  course_description: description,
  MODULE: [] as { LESSONS: unknown[] }[],
});

function renderSection(props: Partial<React.ComponentProps<typeof EventCoursePanel>> = {}) {
  return render(<EventCoursePanel eventId="1" userRole={ROLES.FACILITATOR} canManageCourse={true} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
  byEvent.mockReturnValue({ course: null, loading: false, error: null });
});

afterEach(() => {
  cleanup();
});

describe("EventCoursePanel gating", () => {
  it("shows the create button only to someone who can manage the course", () => {
    renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: true });

    expect(screen.getByText("No course yet for this event.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create Course" })).toBeTruthy();

    cleanup();
    const { container } = renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: false });

    expect(screen.queryByRole("link", { name: "Create Course" })).toBeNull();
    expect(container.querySelectorAll("a").length).toBe(0);
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
    expect(screen.getByRole("link", { name: "Manage Course" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Enter Course Room" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Create Course" })).toBeNull();
  });

  it("points Manage Course at the staff course page", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: course(1, "Intro to Cloudflare", null),
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    expect(screen.getByRole("link", { name: "Manage Course" }).getAttribute("href")).toBe("/staff/events/1/course");
  });

  it("points Enter Course Room at the course room", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: course(1, "Intro to Cloudflare", null),
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    expect(screen.getByRole("link", { name: "Enter Course Room" }).getAttribute("href")).toBe("/courses/1/room");
  });

  it("points Create Course at the staff course page", () => {
    renderSection({ userRole: ROLES.FACILITATOR, canManageCourse: true });

    expect(screen.getByRole("link", { name: "Create Course" }).getAttribute("href")).toBe("/staff/events/1/course");
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
    expect(screen.queryByRole("link", { name: "Manage Course" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Enter Course Room" })).toBeNull();
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
