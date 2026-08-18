import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, loadEventOr403, setMeetingLink } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  loadEventOr403: vi.fn(),
  setMeetingLink: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/lib/event-service", async () => {
  const errors = await vi.importActual<typeof import("@/modules/events/lib/event-errors")>("@/modules/events/lib/event-errors");
  return { ...errors, loadEventOr403, setMeetingLink };
});

import { PATCH } from "@/app/api/events/[id]/meeting-link/route";
import { EventServiceError } from "@/modules/events/lib/event-errors";

const LINK = "https://meet.google.com/abc-defg-hij";

const patch = (body: unknown, id = "1") =>
  PATCH(new Request(`https://app.test/api/events/${id}/meeting-link`, { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({ id: 7, role: "facilitator", full_name: "Fay", email: "fay@example.com" });
  loadEventOr403.mockResolvedValue({ id: 1 });
  setMeetingLink.mockResolvedValue({ id: 1, meeting_url: LINK });
});

describe("PATCH /api/events/[id]/meeting-link", () => {
  it("refuses an unauthenticated caller", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await patch({ meeting_url: LINK })).status).toBe(401);
    expect(setMeetingLink).not.toHaveBeenCalled();
  });

  it("checks the meeting_link capability, not the edit capability", async () => {
    // Editing an event is admin-only by design; this route exists so a
    // facilitator can set the link without being handed the price and the date.
    await patch({ meeting_url: LINK });

    expect(loadEventOr403).toHaveBeenCalledWith({}, 1, expect.objectContaining({ id: 7 }), "meeting_link");
  });

  it("sets the link", async () => {
    const res = await patch({ meeting_url: LINK });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meeting_url: LINK });
    expect(setMeetingLink).toHaveBeenCalledWith({}, 1, LINK, { id: 7 });
  });

  it("clears the link when handed null", async () => {
    setMeetingLink.mockResolvedValue({ id: 1, meeting_url: null });

    const res = await patch({ meeting_url: null });

    expect(res.status).toBe(200);
    expect(setMeetingLink).toHaveBeenCalledWith({}, 1, null, { id: 7 });
  });

  it("refuses a javascript: URL before it ever reaches the row", async () => {
    const res = await patch({ meeting_url: "javascript:alert(1)" });

    expect(res.status).toBe(400);
    expect(setMeetingLink).not.toHaveBeenCalled();
  });

  it("refuses a body with no meeting_url at all", async () => {
    expect((await patch({})).status).toBe(400);
    expect(setMeetingLink).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const res = await PATCH(new Request("https://app.test/api/events/1/meeting-link", { method: "PATCH", body: "not json" }), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(res.status).toBe(400);
  });

  it("answers a 403 from the guard flat, the way its neighbours do", async () => {
    loadEventOr403.mockRejectedValue(new EventServiceError(403, "Forbidden"));

    const res = await patch({ meeting_url: LINK });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("answers a 400 from the service nested, the way its neighbours do", async () => {
    setMeetingLink.mockRejectedValue(new EventServiceError(400, "Only an online event can have a meeting link"));

    const res = await patch({ meeting_url: LINK });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Only an online event can have a meeting link" });
  });
});
