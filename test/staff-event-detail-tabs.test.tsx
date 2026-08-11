// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { UserRole } from "@/shared/types";
import { StaffEventDetailPage } from "@/modules/events/pages/staff-event-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "7" }),
}));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));
vi.mock("@/modules/events/lib/use-event-detail", () => ({ useEventDetail: vi.fn() }));
vi.mock("@/modules/events/lib/use-event-speakers", () => ({ useEventSpeakers: vi.fn() }));
vi.mock("@/modules/courses/lib/use-course-by-event", () => ({ useCourseByEvent: vi.fn() }));
vi.mock("@/modules/courses/lib/use-course-create", () => ({ useCourseCreate: vi.fn() }));
vi.mock("@/modules/surveys/lib/use-survey-status", () => ({ useSurveyStatus: vi.fn() }));

import { useSession } from "@/modules/auth/components/session-context";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";
import { useCourseCreate } from "@/modules/courses/lib/use-course-create";
import { useSurveyStatus } from "@/modules/surveys/lib/use-survey-status";

const noop = vi.fn();

const event = {
  id: 7,
  title: "Launch",
  status: "draft",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
  venue_address: null,
  description: "All about the launch",
  price: 0,
  currency: "PHP",
  cover_image_url: null,
  survey_enabled: false,
  COURSE: null,
  EVENT_FACILITATOR: [],
  EVENT_SPEAKER: [],
  facilitator_ids: [],
  speaker_profile_ids: [],
};

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

function renderDetail(role: UserRole, initialTab?: string) {
  (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 1, role },
    loading: false,
    isLoaded: true,
    isSignedIn: true,
  });
  (useEventDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    event,
    loading: false,
    error: null,
    badgeProps: null,
    publishing: false,
    publishError: null,
    deleteError: null,
    attendeesTotal: 0,
    handlePublish: noop,
    handleDelete: noop,
  });
  (useEventSpeakers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    assignments: [],
    allProfiles: [],
    loading: false,
    profilesLoadingMore: false,
    profilesHasMore: false,
    loadMoreProfiles: noop,
    error: null,
    selectedProfileId: "",
    setSelectedProfileId: noop,
    availableProfiles: [],
    assignedIds: new Set<number>(),
    handleAssign: noop,
    handleRemove: noop,
  });
  (useCourseByEvent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ course: null, loading: false, error: null });
  (useCourseCreate as unknown as ReturnType<typeof vi.fn>).mockReturnValue(emptyBuilder());
  (useSurveyStatus as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    status: null,
    loading: false,
    error: null,
    mutate: noop,
  });

  return render(<StaffEventDetailPage initialTab={initialTab} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  // The embedded edit form and the facilitator table fetch candidate rosters on
  // mount; return empty ones so the admin assertions stay on the page's own UI.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => [] })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("Staff event detail tabs", () => {
  it("shows the merged tab set to an admin with the hero, action buttons and edit form", () => {
    renderDetail(ROLES.ADMIN);

    expect(screen.getByRole("heading", { name: "Launch" })).toBeTruthy();
    for (const label of ["Overview", "Course", "Kiosk", "Surveys"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Event Details" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Speakers" })).toBeNull();

    // Overview is the default and the single merged panel: actions, edit form,
    // cover upload and both assignment tables render together.
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(screen.getByText("Edit Event")).toBeTruthy();
    expect(screen.getByText("Upload image")).toBeTruthy();
    expect(screen.getByText("No facilitators assigned to this event.")).toBeTruthy();
    expect(screen.getByText("No speakers assigned to this event.")).toBeTruthy();
  });

  it("switches the other panels for an admin", () => {
    renderDetail(ROLES.ADMIN);

    fireEvent.click(screen.getByRole("button", { name: "Course" }));
    expect(screen.getByRole("button", { name: "Create Course" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kiosk" }));
    expect(screen.getByRole("button", { name: "Open Kiosk" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Surveys" }));
    expect(screen.getByText("Post-event survey")).toBeTruthy();
  });

  it("shows a facilitator only Overview, Course and Kiosk, with no admin actions", () => {
    renderDetail(ROLES.FACILITATOR);

    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Course" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kiosk" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Surveys" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByText("Edit Event")).toBeNull();
    expect(screen.queryByText("No facilitators assigned to this event.")).toBeNull();
  });

  it("seeds the Overview panel from the C-02 edit link for an admin", () => {
    renderDetail(ROLES.ADMIN, "details");

    expect(screen.getByText("Edit Event")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
  });

  it("clamps a requested tab the role cannot use to Overview", () => {
    renderDetail(ROLES.FACILITATOR, "surveys");

    expect(screen.getByText("OVERVIEW")).toBeTruthy();
    expect(screen.queryByText("Post-event survey")).toBeNull();
  });
});
