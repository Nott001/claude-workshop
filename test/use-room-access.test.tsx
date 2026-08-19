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
import { eventZoneDate, eventZoneTime } from "@/shared/lib/date-utils";

const ATTENDEE = { id: 2, role: ROLES.ATTENDEE, full_name: "Bo", email: "bo@example.com", profile_image_url: null };
const SPEAKER = { ...ATTENDEE, id: 3, role: ROLES.SPEAKER };

const EVENT = {
  id: 9,
  title: "Demo Day",
  event_date: "2020-01-01",
  start_time: "09:00",
  end_time: "17:00",
  COURSE: { id: 4, course_name: "Intro", course_description: null },
  EVENT_SPEAKER: [],
};

function liveWindow() {
  // A window around "now" on the app timezone's calendar — the same clock
  // findLiveModule reads. Built from the runtime's own zone it is only live on
  // a machine that happens to sit in that zone, and never on CI.
  const now = new Date();
  const date = eventZoneDate(now);
  const at = (offsetMs: number) => eventZoneTime(new Date(now.getTime() + offsetMs));
  const clampLow = (time: string) => (time > eventZoneTime(now) ? "00:00:00" : time);
  const clampHigh = (time: string) => (time < eventZoneTime(now) ? "23:59:59" : time);
  return { date, start: clampLow(at(-5 * 60000)), end: clampHigh(at(5 * 60000)) };
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

  it("locks a ticket holder out until the event has started", async () => {
    fetchCourseRoomAccess.mockResolvedValue(roomData({ event: { ...EVENT, event_date: "2099-01-01" } }));

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("not_started"));
    expect(result.current.course).toBeNull();
  });

  it("does not lock staff out of a room that has not started", async () => {
    signedIn(SPEAKER);
    fetchCourseRoomAccess.mockResolvedValue(
      roomData({
        isSpeakerAssigned: true,
        userRole: ROLES.SPEAKER,
        event: { ...EVENT, event_date: "2099-01-01" },
      }),
    );

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.course).toMatchObject({ id: 4 });
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

  it("surfaces the server-side speaker assignment fact", async () => {
    const { result } = renderHook(() => useCourseRoomAccess("9"));
    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.isSpeakerAssigned).toBe(false);

    cleanup();
    fetchCourseRoomAccess.mockResolvedValue(roomData({ isSpeakerAssigned: true }));

    const { result: assigned } = renderHook(() => useCourseRoomAccess("9"));
    await waitFor(() => expect(assigned.current.access).toBe("allowed"));
    expect(assigned.current.isSpeakerAssigned).toBe(true);
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
        // The event has to span the module's window, and that window is built
        // around the clock — EVENT's fixed 09:00–17:00 made this pass only when
        // the suite happened to run inside office hours.
        event: { ...EVENT, event_date: window.date, start_time: "00:00", end_time: "23:59" },
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
    signedIn(SPEAKER);
    fetchCourseRoomAccess.mockResolvedValue(
      roomData({
        isSpeakerAssigned: true,
        userRole: ROLES.SPEAKER,
        event: { ...EVENT, event_date: "2030-01-01" },
      }),
    );

    const { result } = renderHook(() => useCourseRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.liveModule).toBeNull();
  });
});
