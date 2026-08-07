// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";

const { sessionValue, fetchEventAccess, mutateHighlight } = vi.hoisted(() => ({
  sessionValue: vi.fn(),
  fetchEventAccess: vi.fn(),
  mutateHighlight: vi.fn(),
}));

vi.mock("@/modules/auth/components/session-context", () => ({ useSession: () => sessionValue() }));
vi.mock("@/modules/events/lib/fetch-event-access", () => ({ fetchEventAccess }));
vi.mock("@/modules/events/lib/use-event-timer", () => ({
  useEventTimer: () => ({ elapsed: "00:10", remaining: "00:50" }),
}));
vi.mock("swr", () => ({
  default: () => ({ data: { highlighted_lesson_id: 7 }, mutate: mutateHighlight }),
}));

import { useRoomAccess } from "@/modules/events/lib/use-room-access";

const ATTENDEE = { id: 2, role: "attendee", full_name: "Bo", email: "bo@example.com", profile_image_url: null };
const SPEAKER = { ...ATTENDEE, id: 3, role: "speaker" };

const EVENT = {
  id: 9,
  title: "Demo Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  COURSE: { id: 4 },
};

function signedIn(user: unknown = ATTENDEE) {
  sessionValue.mockReturnValue({ isLoaded: true, isSignedIn: true, user });
}

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  fetchEventAccess.mockResolvedValue({ event: EVENT, hasTicket: true, isSpeakerAssigned: false });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ id: 4, course_name: "Intro", MODULE: [] }) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useRoomAccess", () => {
  it("waits rather than deciding before the session has loaded", async () => {
    sessionValue.mockReturnValue({ isLoaded: false, isSignedIn: false, user: null });

    const { result } = renderHook(() => useRoomAccess("9"));

    expect(result.current.access).toBe("loading");
    expect(fetchEventAccess).not.toHaveBeenCalled();
  });

  it("denies a visitor with no session", async () => {
    sessionValue.mockReturnValue({ isLoaded: true, isSignedIn: false, user: null });

    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("denied"));
  });

  it("denies a room whose event does not exist", async () => {
    fetchEventAccess.mockResolvedValue({ event: null, hasTicket: false, isSpeakerAssigned: false });

    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("denied"));
  });

  it("turns a ticketless attendee away with the reason", async () => {
    fetchEventAccess.mockResolvedValue({ event: EVENT, hasTicket: false, isSpeakerAssigned: false });

    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("no_ticket"));
  });

  it("lets a ticket holder in and loads the course", async () => {
    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.course).toMatchObject({ id: 4 });
    expect(result.current.eventTitle).toBe("Demo Day");
  });

  it("distinguishes an event with no course from one the caller may not enter", async () => {
    fetchEventAccess.mockResolvedValue({ event: { ...EVENT, COURSE: null }, hasTicket: true, isSpeakerAssigned: false });

    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("no_course"));
    expect(result.current.course).toBeNull();
  });

  it("still admits the caller when the course request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.access).toBe("allowed"));
    expect(result.current.course).toBeNull();
  });

  it("names a speaker as staff and an attendee as not", async () => {
    const { result: attendee } = renderHook(() => useRoomAccess("9"));
    await waitFor(() => expect(attendee.current.access).toBe("allowed"));
    expect(attendee.current.isStaff).toBe(false);

    cleanup();
    signedIn(SPEAKER);
    fetchEventAccess.mockResolvedValue({ event: EVENT, hasTicket: false, isSpeakerAssigned: true });

    const { result: speaker } = renderHook(() => useRoomAccess("9"));
    await waitFor(() => expect(speaker.current.access).toBe("allowed"));
    expect(speaker.current.isStaff).toBe(true);
  });

  it("reads the highlighted lesson the room is polling for", async () => {
    const { result } = renderHook(() => useRoomAccess("9"));

    await waitFor(() => expect(result.current.highlightedLessonId).toBe(7));
  });

  it("shows the new highlight before the server has confirmed it", async () => {
    // The room is watched live; waiting for the round trip makes the speaker's
    // own click feel broken.
    const { result } = renderHook(() => useRoomAccess("9"));
    await waitFor(() => expect(result.current.access).toBe("allowed"));

    await act(async () => {
      result.current.handleSetHighlight(12);
    });

    expect(mutateHighlight).toHaveBeenCalledWith({ highlighted_lesson_id: 12 }, false);
    expect(fetch).toHaveBeenCalledWith(
      "/api/events/9/live/highlight",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ lesson_id: 12 }) }),
    );
  });

  it("clears the highlight the same way", async () => {
    const { result } = renderHook(() => useRoomAccess("9"));
    await waitFor(() => expect(result.current.access).toBe("allowed"));

    await act(async () => {
      result.current.handleClearHighlight();
    });

    expect(mutateHighlight).toHaveBeenCalledWith({ highlighted_lesson_id: null }, false);
    expect(fetch).toHaveBeenCalledWith("/api/events/9/live/highlight", { method: "DELETE" });
  });

  it("does not act on a room it has already left", async () => {
    // The fetch resolves after unmount; setting state then is the warning this
    // project has chased before.
    let release: (v: unknown) => void = () => {};
    fetchEventAccess.mockReturnValue(new Promise((resolve) => (release = resolve)));

    const { result, unmount } = renderHook(() => useRoomAccess("9"));
    unmount();
    await act(async () => {
      release({ event: EVENT, hasTicket: true, isSpeakerAssigned: false });
    });

    expect(result.current.access).toBe("loading");
  });
});
