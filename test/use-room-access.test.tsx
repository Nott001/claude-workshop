// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";

const { sessionValue, fetchCourseRoomAccess, mutateHighlight } = vi.hoisted(() => ({
  sessionValue: vi.fn(),
  fetchCourseRoomAccess: vi.fn(),
  mutateHighlight: vi.fn(),
}));

vi.mock("@/modules/auth/components/session-context", () => ({ useSession: () => sessionValue() }));
vi.mock("@/modules/courses/lib/fetch-course-room-access", () => ({ fetchCourseRoomAccess }));
vi.mock("@/shared/lib/use-event-timer", () => ({
  useEventTimer: () => ({ elapsed: "00:10", remaining: "00:50" }),
}));
vi.mock("swr", () => ({
  default: () => ({ data: { highlighted_lesson_id: 7 }, mutate: mutateHighlight }),
}));

import { useCourseRoomAccess } from "@/modules/courses/lib/use-course-room-access";

const ATTENDEE = { id: 2, role: ROLES.ATTENDEE, full_name: "Bo", email: "bo@example.com", profile_image_url: null };
const SPEAKER = { ...ATTENDEE, id: 3, role: ROLES.SPEAKER };

const EVENT = {
  id: 9,
  title: "Demo Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  COURSE: { id: 4, course_name: "Intro", course_description: null },
  EVENT_SPEAKER: [],
};

function liveWindow() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const start = new Date(Math.max(now.getTime() - 5 * 60000, dayStart.getTime()));
  const end = new Date(Math.min(now.getTime() + 5 * 60000, dayEnd.getTime()));
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { date: now.toISOString().slice(0, 10), start: fmt(start), end: fmt(end) };
}

function roomData(overrides: Record<string, unknown> = {}) {
  return {
    course: { id: 4, course_name: "Intro", course_description: null, MODULE: [] },
    event: EVENT,
    hasTicket: true,
    isSpeakerAssigned: false,
    speakerProfileId: null,
    userId: 2,
    userRole: ROLES.ATTENDEE,
    ...overrides,
  };
}

function signedIn(user: unknown = ATTENDEE) {
  sessionValue.mockReturnValue({ isLoaded: true, isSignedIn: true, user });
}

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  fetchCourseRoomAccess.mockResolvedValue(roomData());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({}) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useCourseRoomAccess", () => {
  it("waits rather than deciding before the session has loaded", async () => {
    sessionValue.mockReturnValue({ isLoaded: false, isSignedIn: false, user: null });

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    expect(result.current.access).toBe("loading");
    expect(fetchCourseRoomAccess).not.toHaveBeenCalled();
  });

  it("denies a visitor with no session", async () => {
    sessionValue.mockReturnValue({ isLoaded: true, isSignedIn: false, user: null });

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("denied"));
  });

  it("denies a room whose feed returns no event", async () => {
    fetchCourseRoomAccess.mockResolvedValue(roomData({ event: null }));

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("denied"));
  });

  it("turns a ticketless attendee away with the reason", async () => {
    fetchCourseRoomAccess.mockResolvedValue(roomData({ hasTicket: false }));

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("no_ticket"));
  });

  it("lets a ticket holder in and loads the course from the feed", async () => {
    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.course).toMatchObject({ id: 4 });
    expect(result.current.eventTitle).toBe("Demo Day");
    expect(result.current.eventId).toBe("9");
  });

  it("distinguishes a room with no course from one the caller may not enter", async () => {
    fetchCourseRoomAccess.mockResolvedValue(roomData({ course: null }));

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("no_course"));
    expect(result.current.course).toBeNull();
  });

  it("names a speaker as staff and an attendee as not", async () => {
    const { result: attendee } = renderHook(() => useCourseRoomAccess("9"));
    await waitFor(() => expect(attendee.current.access).toBe("allowed"));
    expect(attendee.current.isStaff).toBe(false);

    cleanup();
    signedIn(SPEAKER);
    fetchCourseRoomAccess.mockResolvedValue(roomData({ isSpeakerAssigned: true, userRole: ROLES.SPEAKER }));

    const { result: speaker } = renderHook(() => useCourseRoomAccess("9"));
    await waitFor(() => expect(speaker.current.access).toBe("allowed"));
    expect(speaker.current.isStaff).toBe(true);
  });

  it("reads the highlighted lesson the room is polling for", async () => {
    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.highlightedLessonId).toBe(7));
  });

  it("shows the new highlight before the server has confirmed it", async () => {
    // The room is watched live; waiting for the round trip makes the speaker's
    // own click feel broken.
    const { result } = renderHook(() => useCourseRoomAccess("9"));
    await waitFor(() => expect(result.current.access).toBe("allowed"));

    await act(async () => {
      result.current.handleSetHighlight(12);
    });

    expect(mutateHighlight).toHaveBeenCalledWith({ highlighted_lesson_id: 12 }, false);
    expect(fetch).toHaveBeenCalledWith(
      "/api/courses/9/live/highlight",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ lesson_id: 12 }) }),
    );
  });

  it("clears the highlight the same way", async () => {
    const { result } = renderHook(() => useCourseRoomAccess("9"));
    await waitFor(() => expect(result.current.access).toBe("allowed"));

    await act(async () => {
      result.current.handleClearHighlight();
    });

    expect(mutateHighlight).toHaveBeenCalledWith({ highlighted_lesson_id: null }, false);
    expect(fetch).toHaveBeenCalledWith("/api/courses/9/live/highlight", { method: "DELETE" });
  });

  it("does not act on a room it has already left", async () => {
    // The fetch resolves after unmount; setting state then is the warning this
    // project has chased before.
    let release: (v: unknown) => void = () => {};
    fetchCourseRoomAccess.mockReturnValue(new Promise((resolve) => (release = resolve)));

    const { result, unmount } = renderHook(() => useCourseRoomAccess("9"));
    unmount();
    await act(async () => {
      release(roomData());
    });

    expect(result.current.access).toBe("loading");
  });

  it("reports how many speakers the event is assigned", async () => {
    fetchCourseRoomAccess.mockResolvedValue(
      roomData({
        event: {
          ...EVENT,
          EVENT_SPEAKER: [{ SPEAKER_PROFILE: { id: 1 } }, { SPEAKER_PROFILE: { id: 2 } }],
        },
      }),
    );

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.assignedSpeakerCount).toBe(2);
  });

  it("names the module whose session is live right now", async () => {
    const window = liveWindow();
    fetchCourseRoomAccess.mockResolvedValue(
      roomData({
        event: { ...EVENT, event_date: window.date },
        course: {
          id: 4,
          course_name: "Intro",
          course_description: null,
          MODULE: [
            {
              id: 11,
              module_name: "Keynote",
              sequence_order: 1,
              module_type: "lessons",
              is_locked: false,
              start_time: window.start,
              end_time: window.end,
              speaker_profile_id: null,
              SPEAKER_PROFILE: null,
              LESSONS: [],
            },
          ],
        },
      }),
    );

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.liveModule?.module_name).toBe("Keynote"));
  });

  it("leaves the live module empty before the first session starts", async () => {
    fetchCourseRoomAccess.mockResolvedValue(roomData({ event: { ...EVENT, event_date: "2030-01-01" } }));

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.liveModule).toBeNull();
  });
});
