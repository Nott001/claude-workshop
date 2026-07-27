import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatEventDate, formatTime, eventStatusLabel, isEventLive, accentClass, getUpcomingEvents } from "@/lib/landing";

let fromMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/db", () => ({
  getServiceClient: vi.fn(() => ({
    from: (...args: unknown[]) => fromMock(...args),
  })),
}));

function makeChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("landing helpers", () => {
  it("formatEventDate produces human-readable dates", () => {
    expect(formatEventDate("2026-05-24")).toContain("May");
    expect(formatEventDate("2026-05-24")).toContain("24");
    expect(formatEventDate("2026-05-24")).toContain("2026");
  });

  it("formatTime converts 24h to 12h", () => {
    expect(formatTime("10:00")).toBe("10:00 AM");
    expect(formatTime("18:30")).toBe("6:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("eventStatusLabel maps statuses correctly", () => {
    expect(eventStatusLabel("active")).toBe("Upcoming");
    expect(eventStatusLabel("draft")).toBe("Draft");
    expect(eventStatusLabel("complete")).toBe("Past");
    expect(eventStatusLabel("unknown")).toBe("unknown");
  });

  it("accentClass cycles through gradient classes", () => {
    expect(accentClass(0)).toBe("from-sky-500 via-cyan-400 to-teal-300");
    expect(accentClass(4)).toBe(accentClass(0));
  });

  describe("isEventLive", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns true when now is within the event window", () => {
      vi.setSystemTime(new Date("2026-06-15T10:30:00"));
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(true);
    });

    it("returns false when now is before start time", () => {
      vi.setSystemTime(new Date("2026-06-15T09:00:00"));
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(false);
    });

    it("returns false when now is after end time", () => {
      vi.setSystemTime(new Date("2026-06-15T13:00:00"));
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(false);
    });

    it("returns true at the exact start time boundary", () => {
      vi.setSystemTime(new Date("2026-06-15T10:00:00"));
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(true);
    });

    it("returns true at the exact end time boundary", () => {
      vi.setSystemTime(new Date("2026-06-15T12:00:00"));
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(true);
    });
  });
});

describe("getUpcomingEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped events from Supabase", async () => {
    const rawEvents = [
      {
        id: 1,
        title: "AI Workshop",
        event_date: "2026-09-15",
        start_time: "10:00",
        end_time: "12:00",
        venue_name: "Main Hall",
        cover_image_url: null,
        status: "active",
        COURSE: { course_name: "AI 101" },
      },
      {
        id: 2,
        title: "Founders Night",
        event_date: "2026-09-22",
        start_time: "18:30",
        end_time: "21:00",
        venue_name: "Rooftop",
        cover_image_url: null,
        status: "draft",
        COURSE: null,
      },
    ];
    fromMock = vi.fn().mockReturnValue(makeChain(rawEvents));

    const events = await getUpcomingEvents();

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      event_id: 1,
      title: "AI Workshop",
      event_date: "2026-09-15",
      start_time: "10:00",
      end_time: "12:00",
      venue_name: "Main Hall",
      status: "active",
      course_name: "AI 101",
      cover_image_url: null,
    });
    expect(events[1].course_name).toBeNull();
  });

  it("returns empty array when Supabase returns null", async () => {
    fromMock = vi.fn().mockReturnValue(makeChain(null));

    const events = await getUpcomingEvents();
    expect(events).toEqual([]);
  });

  it("queries EVENTS table with active-only filter", async () => {
    const chain = makeChain([]);
    fromMock = vi.fn().mockReturnValue(chain);

    await getUpcomingEvents();

    expect(fromMock).toHaveBeenCalledWith("EVENT");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
    expect(chain.limit).toHaveBeenCalledWith(2);
  });
});
