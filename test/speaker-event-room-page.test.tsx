// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SpeakerEventRoomPage from "@/app/speaker/event/[eventId]/room/page";

const { useRoomAccess } = vi.hoisted(() => ({ useRoomAccess: vi.fn() }));

vi.mock("@/modules/events/lib/use-room-access", () => ({ useRoomAccess }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ eventId: "42" }),
  useRouter: () => ({ push: vi.fn() }),
}));

function allowRoom(overrides: Record<string, unknown> = {}) {
  useRoomAccess.mockReturnValue({
    access: "allowed",
    eventTitle: "Demo Day",
    eventDate: "",
    startTime: "",
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

describe("SpeakerEventRoomPage", () => {
  it("passes the eventId route segment to the room-access hook, not undefined", () => {
    render(<SpeakerEventRoomPage />);

    expect(useRoomAccess).toHaveBeenCalledWith("42");
    expect(useRoomAccess).not.toHaveBeenCalledWith(undefined);
  });

  it("renders the room for an assigned speaker", () => {
    render(<SpeakerEventRoomPage />);

    expect(screen.getByText("Demo Day")).toBeTruthy();
  });

  it("shows the denial message when the hook denies access", () => {
    allowRoom({ access: "denied" });

    render(<SpeakerEventRoomPage />);

    expect(screen.getByText("Access denied.")).toBeTruthy();
  });

  it("marks the live module and its speaker when the event has several speakers", () => {
    allowRoom({
      liveModule: {
        id: 1,
        module_name: "Keynote",
        start_time: "09:00:00",
        end_time: "10:00:00",
        SPEAKER_PROFILE: { id: 7, USER: { full_name: "Ada Lovelace" } },
      },
      assignedSpeakerCount: 2,
      course: {
        id: 4,
        course_name: "Intro",
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

    render(<SpeakerEventRoomPage />);

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getAllByText("Keynote").length).toBeGreaterThan(0);
    expect(screen.getByText("Live now")).toBeTruthy();
    expect(screen.getAllByText(/Ada Lovelace/).length).toBeGreaterThan(0);
  });

  it("hides speaker names when the event has a single assigned speaker", () => {
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

    render(<SpeakerEventRoomPage />);

    expect(screen.queryByText(/Ada Lovelace/)).toBeNull();
  });
});
