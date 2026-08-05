import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchEventAccess } from "@/modules/events/lib/fetch-event-access";
import type { AuthUser } from "@/modules/auth";
import type { UserRole } from "@/shared/types";

const eventId = "42";

const mockEvent = {
  id: 42,
  title: "Test Event",
  event_date: "2026-07-30",
  start_time: "09:00",
  end_time: "17:00",
  EVENT_SPEAKER: [{ SPEAKER_PROFILE: { id: 99 } }],
  COURSE: null,
};

// GET /api/auth/me carries the caller's own speaker_profile_id; a speaker is
// just a user, so there is no separate /api/speakers/me profile route.
const mockSpeakerProfile = { speaker_profile_id: 99, id: 1 };

const mockTicket = { event_id: 42, status: "confirmed" };
const mockCancelledTicket = { event_id: 42, status: "cancelled" };

function mockFetch(responses: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
    const path = typeof url === "string" ? url : url.toString();
    const data = responses[path];
    return { ok: true, json: async () => data } as Response;
  });
}

function user(role: UserRole): AuthUser {
  return { id: 1, role, full_name: "Test User", email: "test@example.com", profile_image_url: null };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchEventAccess", () => {
  it("fetches tickets for attendee, returns hasTicket=true", async () => {
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
      "/api/tickets": [mockTicket],
    });

    const result = await fetchEventAccess(eventId, user("attendee"));

    expect(result.hasTicket).toBe(true);
    expect(result.isSpeakerAssigned).toBe(false);
  });

  it("returns hasTicket=false for attendee without tickets", async () => {
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
      "/api/tickets": [],
    });

    const result = await fetchEventAccess(eventId, user("attendee"));

    expect(result.hasTicket).toBe(false);
  });

  it("skips ticket fetch for speaker, hasTicket is false", async () => {
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
      "/api/auth/me": mockSpeakerProfile,
    });

    const result = await fetchEventAccess(eventId, user("speaker"));

    expect(result.hasTicket).toBe(false);
    expect(result.isSpeakerAssigned).toBe(true);
  });

  it("marks speaker as assigned when profile matches event speaker", async () => {
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
      "/api/auth/me": mockSpeakerProfile,
    });

    const result = await fetchEventAccess(eventId, user("speaker"));

    expect(result.isSpeakerAssigned).toBe(true);
  });

  it("marks speaker as not assigned when profile does not match", async () => {
    const differentSpeaker = { speaker_profile_id: 999, id: 1 };
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
      "/api/auth/me": differentSpeaker,
    });

    const result = await fetchEventAccess(eventId, user("speaker"));

    expect(result.isSpeakerAssigned).toBe(false);
  });

  it("skips ticket fetch for facilitator", async () => {
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
    });

    const result = await fetchEventAccess(eventId, user("facilitator"));

    expect(result.hasTicket).toBe(false);
  });

  it("ignores cancelled tickets for attendee", async () => {
    mockFetch({
      [`/api/events/${eventId}`]: mockEvent,
      "/api/tickets": [mockCancelledTicket],
    });

    const result = await fetchEventAccess(eventId, user("attendee"));

    expect(result.hasTicket).toBe(false);
  });
});
