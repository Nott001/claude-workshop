// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import { useEventDetail } from "@/modules/events/lib/use-event-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));

import { useSession } from "@/modules/auth/components/session-context";

const baseEvent = {
  id: 7,
  title: "Launch Day",
  event_date: "2099-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
  venue_address: null,
  course_id: null,
  cover_image_url: null,
  status: "active",
  price: 0,
  currency: "PHP",
  description: null,
  survey_enabled: false,
  COURSE: null,
  EVENT_SPEAKER: [],
};

function stubSession(role: string | null) {
  (useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    isLoaded: true,
    isSignedIn: role != null,
    user: role ? { id: 1, role } : null,
  });
}

type SpeakerEvent = Omit<typeof baseEvent, "EVENT_SPEAKER"> & {
  EVENT_SPEAKER: Array<{ SPEAKER_PROFILE: { id: number; user_id: number } }>;
};

function stubFetch({
  event = baseEvent,
  hasTicket = false,
  speakerProfileId = null,
  publishError = null,
  deleteError = null,
  attendeeError = false,
}: {
  event?: SpeakerEvent;
  hasTicket?: boolean;
  speakerProfileId?: number | null;
  publishError?: string | null;
  deleteError?: string | null;
  attendeeError?: boolean;
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/attendees?limit=5")) {
        if (attendeeError) throw new Error("boom");
        return {
          ok: true,
          json: async () => ({
            attendees: [
              {
                user_id: 2,
                full_name: "Ada",
                email: "ada@example.com",
                ticket_status: "issued",
                issued_at: "",
                checked_in_at: null,
              },
            ],
            total: 1,
          }),
        };
      }
      if (init?.method === "POST" && url.endsWith("/publish")) {
        return { ok: publishError == null, json: async () => ({ error: publishError }) };
      }
      if (init?.method === "DELETE") {
        return { ok: deleteError == null, json: async () => ({ error: deleteError }) };
      }
      return { ok: true, json: async () => ({ ...event, hasTicket, speakerProfileId }) };
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stubSession(ROLES.ATTENDEE);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useEventDetail", () => {
  it("loads the event alongside the ticket and speaker facts", async () => {
    const event = {
      ...baseEvent,
      EVENT_SPEAKER: [{ SPEAKER_PROFILE: { id: 5, user_id: 10 } }],
    };
    stubFetch({ event, hasTicket: true, speakerProfileId: 5 });

    const { result } = renderHook(() => useEventDetail("7"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event?.title).toBe("Launch Day");
    expect(result.current.hasTicket).toBe(true);
    expect(result.current.isSpeakerAssigned).toBe(true);
    expect(result.current.eventStarted).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports Event not found when the load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const { result } = renderHook(() => useEventDetail("7"));

    await waitFor(() => expect(result.current.error).toBe("Event not found"));
    expect(result.current.event).toBeNull();
  });

  it("sends a signed-out guest to sign-up with a redirect back to the event", async () => {
    stubSession(null);
    stubFetch();

    const { result } = renderHook(() => useEventDetail("7"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleRegister();
    });
    expect(push).toHaveBeenCalledWith("/sign-up?redirect_url=/events/7");
  });

  it("sends a signed-in attendee to the register page", async () => {
    stubFetch();

    const { result } = renderHook(() => useEventDetail("7"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleRegister();
    });
    expect(push).toHaveBeenCalledWith("/events/7/register");
  });

  it("fetches recent attendees for a facilitator and clears the loading flag", async () => {
    stubSession(ROLES.FACILITATOR);
    stubFetch();

    const { result } = renderHook(() => useEventDetail("7"));

    expect(result.current.attendeesLoading).toBe(true);
    await waitFor(() => expect(result.current.attendeesLoading).toBe(false));
    expect(result.current.recentAttendees[0].full_name).toBe("Ada");
    expect(result.current.attendeesTotal).toBe(1);
  });

  it("clears the attendees loading flag when the fetch rejects", async () => {
    stubSession(ROLES.FACILITATOR);
    stubFetch({ attendeeError: true });

    const { result } = renderHook(() => useEventDetail("7"));

    await waitFor(() => expect(result.current.attendeesLoading).toBe(false));
  });

  it("publishes the event and marks it active", async () => {
    stubFetch();

    const { result } = renderHook(() => useEventDetail("7"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handlePublish();
    });
    expect(result.current.event?.status).toBe("active");
    expect(result.current.publishing).toBe(false);
  });

  it("reports a publish failure instead of crashing", async () => {
    stubFetch({ publishError: "nope" });

    const { result } = renderHook(() => useEventDetail("7"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handlePublish();
    });
    expect(result.current.publishError).toBe("nope");
  });

  it("deletes the event and routes back to the events list", async () => {
    stubFetch();

    const { result } = renderHook(() => useEventDetail("7"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDelete();
    });
    expect(push).toHaveBeenCalledWith("/events");
  });

  it("reports a delete failure without routing away", async () => {
    stubFetch({ deleteError: "nope" });

    const { result } = renderHook(() => useEventDetail("7"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleDelete();
    });
    expect(result.current.deleteError).toBe("nope");
    expect(push).not.toHaveBeenCalled();
  });
});
