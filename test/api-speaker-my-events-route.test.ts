import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getCurrentUser, findByUserId, getSpeakerEventIds, findByIds } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findByUserId: vi.fn(),
  getSpeakerEventIds: vi.fn(),
  findByIds: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ findByUserId, getSpeakerEventIds }));
vi.mock("@/modules/events/db/event.dao", () => ({ findByIds }));

import { GET } from "@/app/api/speakers/me/events/route";

const user = { id: 5, role: ROLES.SPEAKER };
const profile = { id: 7, user_id: 5, bio: null, photo_url: null, designation: null };
const rows = [
  {
    id: 9,
    title: "Launch Day",
    event_date: "2026-08-01",
    start_time: "09:00",
    end_time: "17:00",
    venue_name: "Main Hall",
    status: "active",
    event_type: "onsite",
    cover_image_url: null,
    COURSE: null,
  },
  {
    id: 10,
    title: "Wrap Up",
    event_date: "2026-08-02",
    start_time: "10:00",
    end_time: "18:00",
    venue_name: "Zoom",
    status: "complete",
    event_type: "online",
    cover_image_url: null,
    COURSE: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(user);
  findByUserId.mockResolvedValue(profile);
  getSpeakerEventIds.mockResolvedValue([9, 10]);
  findByIds.mockResolvedValue(rows);
});

describe("GET /api/speakers/me/events", () => {
  it("returns an empty list for a caller with no session before any lookup", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/speakers/me/events"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
    expect(getSpeakerEventIds).not.toHaveBeenCalled();
    expect(findByIds).not.toHaveBeenCalled();
  });

  it("returns an empty list for a user with no speaker profile", async () => {
    findByUserId.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/speakers/me/events"));

    await expect(res.json()).resolves.toEqual([]);
    expect(getSpeakerEventIds).not.toHaveBeenCalled();
  });

  it("returns an empty list when the speaker has no assigned events", async () => {
    getSpeakerEventIds.mockResolvedValue([]);

    const res = await GET(new Request("https://app.test/api/speakers/me/events"));

    await expect(res.json()).resolves.toEqual([]);
    expect(findByIds).not.toHaveBeenCalled();
  });

  it("forwards the filter to findByIds and serves the landing shape", async () => {
    const res = await GET(new Request("https://app.test/api/speakers/me/events?filter=upcoming"));

    expect(res.status).toBe(200);
    expect(findByIds).toHaveBeenCalledWith({}, [9, 10], { filter: "upcoming" });
    const body = await res.json();
    expect(body.map((e: { event_id: number }) => e.event_id)).toEqual([9, 10]);
  });

  it("passes filter null when no filter is given", async () => {
    const res = await GET(new Request("https://app.test/api/speakers/me/events"));

    expect(res.status).toBe(200);
    expect(findByIds).toHaveBeenCalledWith({}, [9, 10], { filter: null });
  });

  it("refuses an unknown filter with 400 before any database work", async () => {
    const res = await GET(new Request("https://app.test/api/speakers/me/events?filter=bogus"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Unknown filter" });
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(findByIds).not.toHaveBeenCalled();
  });
});
