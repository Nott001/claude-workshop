// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CourseRoomPage from "@/app/courses/[courseId]/room/page";

const { useCourseRoomAccess } = vi.hoisted(() => ({ useCourseRoomAccess: vi.fn() }));

vi.mock("@/modules/courses/lib/use-course-room-access", () => ({ useCourseRoomAccess }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ courseId: "42" }),
  useRouter: () => ({ push: vi.fn() }),
}));

function allowRoom(overrides: Record<string, unknown> = {}) {
  useCourseRoomAccess.mockReturnValue({
    access: "allowed",
    eventId: "42",
    eventTitle: "Demo Day",
    eventDate: "",
    startTime: "",
    endTime: "",
    course: null,
    userRole: "speaker",
    liveModule: null,
    assignedSpeakerCount: 0,
    eventStarted: false,
    eventEnded: false,
    elapsed: "00:00",
    remaining: "00:00",
    highlightedLessonId: null,
    settingHighlight: false,
    handleSetHighlight: vi.fn(),
    handleClearHighlight: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  allowRoom();
});

afterEach(() => {
  cleanup();
});

describe("CourseRoomPage", () => {
  it("passes the courseId route segment to the room-access hook, not undefined", () => {
    render(<CourseRoomPage />);

    expect(useCourseRoomAccess).toHaveBeenCalledWith("42");
    expect(useCourseRoomAccess).not.toHaveBeenCalledWith(undefined);
  });

  it("renders the room for any allowed role", () => {
    render(<CourseRoomPage />);

    expect(screen.getByText("Demo Day")).toBeTruthy();
    expect(screen.getByText("EXIT COURSE ROOM")).toBeTruthy();
  });

  it("shows the loading copy while the room is resolving", () => {
    allowRoom({ access: "loading" });

    render(<CourseRoomPage />);

    expect(screen.getByText(/Loading course room/)).toBeTruthy();
  });

  it("shows the sign-in message when the hook denies access", () => {
    allowRoom({ access: "denied" });

    render(<CourseRoomPage />);

    expect(screen.getByText("You need to sign in to access this room.")).toBeTruthy();
  });

  it("offers the register CTA to a ticketless attendee", () => {
    allowRoom({ access: "no_ticket", eventId: "42", userRole: "attendee" });

    render(<CourseRoomPage />);

    expect(screen.getByText("You need a ticket to access this room.")).toBeTruthy();
    expect(screen.getByText("Register")).toBeTruthy();
  });

  it("marks the live module and its speaker when the course has several speakers", () => {
    allowRoom({
      liveModule: {
        id: 1,
        module_name: "Keynote",
        start_time: "09:00:00",
        end_time: "10:00:00",
        SPEAKER_PROFILE: { id: 7, USER: { full_name: "Ada Lovelace" } },
      },
      assignedSpeakerCount: 2,
      eventDate: "2026-01-01",
      startTime: "09:00:00",
      endTime: "17:00:00",
      course: {
        id: 4,
        course_name: "Intro",
        course_description: null,
        MODULE: [
          {
            id: 1,
            module_name: "Keynote",
            sequence_order: 1,
            module_type: "lessons",
            is_locked: false,
            start_time: "09:00:00",
            end_time: "10:00:00",
            speaker_profile_id: 7,
            SPEAKER_PROFILE: { id: 7, designation: null, USER: { full_name: "Ada Lovelace" } },
            LESSONS: [],
          },
        ],
      },
    });

    render(<CourseRoomPage />);

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getAllByText("Keynote")).toHaveLength(3);
    expect(screen.getByText("Live now")).toBeTruthy();
    expect(screen.getAllByText(/Ada Lovelace/).length).toBeGreaterThan(0);
    expect(screen.getByText("Agenda")).toBeTruthy();
    expect(screen.getByText("Event start")).toBeTruthy();
    expect(screen.getByText("Event end")).toBeTruthy();
  });

  it("hides speaker names when the course has a single assigned speaker", () => {
    allowRoom({
      liveModule: {
        id: 1,
        module_name: "Keynote",
        start_time: "09:00:00",
        end_time: "10:00:00",
        SPEAKER_PROFILE: { id: 7, USER: { full_name: "Ada Lovelace" } },
      },
      assignedSpeakerCount: 1,
      course: {
        id: 4,
        course_name: "Intro",
        course_description: null,
        MODULE: [
          {
            id: 1,
            module_name: "Keynote",
            sequence_order: 1,
            module_type: "lessons",
            is_locked: false,
            start_time: "09:00:00",
            end_time: "10:00:00",
            speaker_profile_id: 7,
            SPEAKER_PROFILE: { id: 7, designation: null, USER: { full_name: "Ada Lovelace" } },
            LESSONS: [],
          },
        ],
      },
    });

    render(<CourseRoomPage />);

    expect(screen.queryByText(/Ada Lovelace/)).toBeNull();
  });
});
