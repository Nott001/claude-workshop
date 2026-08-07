// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CourseSection } from "@/app/staff/events/[id]/page";

vi.mock("@/modules/courses/lib/use-course-by-event", () => ({ useCourseByEvent: vi.fn() }));
vi.mock("@/modules/courses/lib/use-course-create", () => ({ useCourseCreate: vi.fn() }));
vi.mock("@/modules/events/lib/use-event-speakers", () => ({ useEventSpeakers: vi.fn() }));
vi.mock("@/modules/events/lib/use-assigned-speakers", () => ({ useAssignedSpeakers: vi.fn() }));

import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";
import { useAssignedSpeakers } from "@/modules/events/lib/use-assigned-speakers";

const noop = vi.fn();

function emptyBuilder() {
  return {
    modules: [],
    lessonDialogModuleId: null,
    setLessonDialogModuleId: noop,
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

beforeEach(() => {
  vi.clearAllMocks();
  const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
  const create = useCourseCreate as unknown as ReturnType<typeof vi.fn>;
  const speakers = useEventSpeakers as unknown as ReturnType<typeof vi.fn>;
  const assigned = useAssignedSpeakers as unknown as ReturnType<typeof vi.fn>;
  byEvent.mockReturnValue({ course: null, loading: false, error: null });
  create.mockReturnValue(emptyBuilder());
  speakers.mockReturnValue({ assignments: [], loading: false });
  assigned.mockReturnValue({ speakers: [], loading: false, error: null });
});

afterEach(() => {
  cleanup();
});

describe("CourseSection gating", () => {
  it("shows the create button only to someone who can manage the course", () => {
    render(
      <CourseSection eventId="1" userRole="facilitator" canManageCourse={true} eventStartTime="09:00" eventEndTime="17:00" />,
    );

    expect(screen.getByText("No course yet for this event.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Course" })).toBeTruthy();

    cleanup();
    const { container } = render(
      <CourseSection eventId="1" userRole="facilitator" canManageCourse={false} eventStartTime="09:00" eventEndTime="17:00" />,
    );

    expect(screen.queryByRole("button", { name: "Create Course" })).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("renders the read-only course summary once a course exists, even for managers", () => {
    const byEvent = useCourseByEvent as unknown as ReturnType<typeof vi.fn>;
    byEvent.mockReturnValue({
      course: { id: 1, course_name: "Intro to Cloudflare", course_description: null, MODULE: [] },
      loading: false,
      error: null,
    });

    render(<CourseSection eventId="1" userRole="admin" canManageCourse={true} eventStartTime="09:00" eventEndTime="17:00" />);

    expect(screen.getByText("Intro to Cloudflare")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Course" })).toBeNull();
  });

  it("renders nothing for a non-staff member without access", () => {
    const { container } = render(
      <CourseSection eventId="1" userRole="attendee" canManageCourse={false} eventStartTime="09:00" eventEndTime="17:00" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows the waiting state for staff who are not assigned", () => {
    render(
      <CourseSection eventId="1" userRole="facilitator" canManageCourse={false} eventStartTime="09:00" eventEndTime="17:00" />,
    );

    expect(screen.getByText("Waiting for the speaker to create a course for this event.")).toBeTruthy();
  });
});
