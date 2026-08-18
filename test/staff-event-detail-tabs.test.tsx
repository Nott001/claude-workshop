// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { UserRole } from "@/shared/types";
import { StaffEventDetailPage } from "@/modules/events/pages/staff-event-detail";
import { expectStaffColumn } from "./helpers/staff-column";

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

function renderDetail(
  role: UserRole,
  initialTab?: string,
  eventOverride?: Partial<typeof event>,
  applyEventPatch: (patch: Record<string, unknown>) => void = noop,
) {
  const liveEvent = { ...event, ...eventOverride };
  (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 1, role },
    loading: false,
    isLoaded: true,
    isSignedIn: true,
  });
  (useEventDetail as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    event: liveEvent,
    loading: false,
    error: null,
    publishing: false,
    publishError: null,
    deleteError: null,
    attendeesTotal: 0,
    handlePublish: noop,
    handleDelete: noop,
    applyEventPatch: (patch: Record<string, unknown>) => {
      Object.assign(liveEvent, patch);
      applyEventPatch(patch);
    },
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
  it("gives an admin one tab per concern, with the event actions above them", () => {
    renderDetail(ROLES.ADMIN);

    expect(screen.getByRole("heading", { name: "Launch" })).toBeTruthy();
    for (const label of ["Overview", "Details", "Team", "Course", "Attendees", "Surveys"]) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }

    // Publish and the kiosk apply to the whole event, so they sit outside the
    // panels rather than inside whichever one used to own them.
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open Kiosk/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Kiosk" })).toBeNull();
  });

  it("opens on a read-only overview, with no form and no roster", () => {
    renderDetail(ROLES.ADMIN);

    expect(screen.getByText("All about the launch")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete event" })).toBeTruthy();
    // The edit form and the assignment tables have their own tabs now; the
    // overview rendering them was the whole of the nested-page problem.
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByText("Upload image")).toBeNull();
    expect(screen.queryByText("No facilitators assigned to this event.")).toBeNull();
  });

  it("edits the event under Details, without a nested page frame", () => {
    const { container } = renderDetail(ROLES.ADMIN, "details");

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Launch");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    // The same cover section the create form carries, stated once so the two
    // cannot drift into two sections doing the same thing in different words.
    expect(screen.getByText("COVER IMAGE")).toBeTruthy();
    expect(screen.getByText("Upload image")).toBeTruthy();

    // The form used to bring its own page shell in here, back link and all.
    expect(screen.queryByRole("link", { name: "Back to Event" })).toBeNull();
    expectStaffColumn(container);
  });

  it("holds Save until something has actually changed", () => {
    renderDetail(ROLES.ADMIN, "details");

    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Launch Day" } });
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeTruthy();
  });

  it("staffs the event under Team, in one place only", () => {
    renderDetail(ROLES.ADMIN, "team");

    expect(screen.getByText("No facilitators assigned to this event.")).toBeTruthy();
    expect(screen.getByText("No speakers assigned to this event.")).toBeTruthy();
    // Team is not also a section of the edit form any more.
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  // The page used to mount the speaker roster for everyone on arrival, so a
  // facilitator who cannot even see Team paid for two requests to build it.
  it("does not load the speaker roster until the Team tab is opened", () => {
    renderDetail(ROLES.ADMIN);
    expect(useEventSpeakers).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Team" }));
    expect(useEventSpeakers).toHaveBeenCalledWith("7");
  });

  it("switches the remaining panels for an admin", () => {
    renderDetail(ROLES.ADMIN);

    fireEvent.click(screen.getByRole("tab", { name: "Course" }));
    expect(screen.getByRole("link", { name: "Create Course" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Surveys" }));
    expect(screen.getByRole("switch", { name: "Enable post-event survey" })).toBeTruthy();
  });

  it("keeps the survey opt-in when leaving and returning to the Surveys tab", async () => {
    const patches: Record<string, unknown>[] = [];
    renderDetail(ROLES.ADMIN, "surveys", { survey_enabled: false }, (p) => patches.push(p));

    const toggle = screen.getByRole("switch", { name: "Enable post-event survey" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);

    // The PATCH mock resolves ok:true, so handleToggle calls onSaved and the
    // page's event now carries the new value.
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(patches).toEqual([{ survey_enabled: true }]);

    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    fireEvent.click(screen.getByRole("tab", { name: "Surveys" }));

    const remounted = screen.getByRole("switch", { name: "Enable post-event survey" });
    await waitFor(() => expect(remounted.getAttribute("aria-checked")).toBe("true"));
  });

  it("shows the survey opt-in as a labelled row with a visible Off state", () => {
    renderDetail(ROLES.ADMIN, "surveys", { survey_enabled: false });

    expect(screen.getByText("Opt-in to post-event survey")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Enable post-event survey" })).toBeTruthy();
    expect(screen.queryByText("Surveys are off for this event.")).toBeNull();
  });

  it("shows an On status once the survey opt-in is enabled", () => {
    renderDetail(ROLES.ADMIN, "surveys", { survey_enabled: true });

    expect(screen.getByText("On")).toBeTruthy();
  });

  it("shows a facilitator only Overview and Course, with no admin actions", () => {
    renderDetail(ROLES.FACILITATOR);

    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Course" })).toBeTruthy();
    for (const label of ["Details", "Team", "Attendees", "Surveys"]) {
      expect(screen.queryByRole("tab", { name: label })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete event" })).toBeNull();
    // The kiosk is the one whole-event action a facilitator keeps.
    expect(screen.getByRole("link", { name: /Open Kiosk/ })).toBeTruthy();
  });

  it("clamps a requested tab the role cannot use to Overview", () => {
    renderDetail(ROLES.FACILITATOR, "surveys");

    expect(screen.getByText("OVERVIEW")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Enable post-event survey" })).toBeNull();
  });

  it("shows a locked bulk send button until the event ends", () => {
    renderDetail(ROLES.ADMIN, "surveys", { survey_enabled: true, event_date: "2099-01-01" });

    const sendButton = screen.getByRole("button", { name: "Locked until event ends" });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows an enabled bulk send button once the event has ended", () => {
    renderDetail(ROLES.ADMIN, "surveys", { survey_enabled: true, event_date: "2020-01-01" });

    const sendButton = screen.getByRole("button", { name: "Send bulk survey" });
    expect((sendButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders no bulk send button when surveys are off", () => {
    renderDetail(ROLES.ADMIN, "surveys");

    expect(screen.queryByRole("button", { name: "Send bulk survey" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Locked until event ends" })).toBeNull();
  });

  // This page is where a facilitator lands from their own event list, so it has
  // to be measured to the same column the list is. Its width was the deliberate
  // one — matched to the public detail page — and is now the shared token, so
  // this asserts the page reads it rather than spelling a number of its own.
  it("sits in the same column as every other staff page, for both roles", () => {
    for (const role of [ROLES.ADMIN, ROLES.FACILITATOR] as UserRole[]) {
      const { container, unmount } = renderDetail(role);

      expectStaffColumn(container, role);
      unmount();
    }
  });
});
