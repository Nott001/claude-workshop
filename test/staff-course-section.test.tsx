// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CourseSection } from "@/modules/events/pages/staff-event-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/courses/lib/use-course-by-event", () => ({ useCourseByEvent: vi.fn() }));
vi.mock("@/modules/courses/lib/use-course-create", () => ({ useCourseCreate: vi.fn() }));

import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";

const noop = vi.fn();

function emptyBuilder() {
  return {
    modules: [],
    lessonDialogModuleId: null,
    setLessonDialogModuleId: noop,
    setModules: noop,
    handleCreateCourse: noop,
    handleAddModule: noop,
    handleAddQaModule: noop,
    handleRenameModule: noop,
    handleDeleteModule: noop,
    handleDeleteLesson: noop,
    openLessonDialog: noop,
    handleAddLesson: noop,
    handleReorderModules: noop,
    handleMoveLesson: noop,
    handleUpdateModuleSchedule: noop,
  };
}

function renderSection(props: Partial<React.ComponentProps<typeof CourseSection>> = {}) {
  return render(
    <CourseSection
      eventId="1"
      userRole={ROLES.FACILITATOR}
      canManageCourse={true}
      eventSpeakers={[]}
      speakersLoading={false}
      eventStartTime="09:00"
      eventEndTime="17:00"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
  const create = useCourseCreate as unknown as ReturnType<typeof vi.fn>;
  byEvent.mockReturnValue({ course: null, loading: false, error: null });
  create.mockReturnValue(emptyBuilder());
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
      course: { id: 1, course_name: "Intro to Cloudflare", course_description: null, MODULE: [] },
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    expect(screen.getByText("Intro to Cloudflare")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage Course" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter Course Room" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Course" })).toBeNull();
  });

  it("opens the builder for an existing course from Manage Course", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: { id: 1, course_name: "Intro to Cloudflare", course_description: null, MODULE: [] },
      loading: false,
      error: null,
    });

    renderSection({ userRole: ROLES.ADMIN, canManageCourse: true });

    fireEvent.click(screen.getByRole("button", { name: "Manage Course" }));
    expect(screen.getByText("Back to summary")).toBeTruthy();
  });

  it("renders the read-only course summary for a non-manager staff member", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: { id: 1, course_name: "Intro to Cloudflare", course_description: null, MODULE: [] },
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
