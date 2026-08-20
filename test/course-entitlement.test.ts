import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getSetting, userHasCourseAccess, listCourseSummaries, listEventWindowsByUser } = vi.hoisted(() => ({
  getSetting: vi.fn(),
  userHasCourseAccess: vi.fn(),
  listCourseSummaries: vi.fn(),
  listEventWindowsByUser: vi.fn(),
}));

vi.mock("@/shared/db/dao/system-setting.dao", () => ({ getSetting }));
vi.mock("@/shared/db/dao/course.dao", () => ({ userHasCourseAccess, listCourseSummaries }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ listEventWindowsByUser }));

import { listReleasedCourses, resolveCourseGrant } from "@/modules/courses/lib/course-entitlement";

const db = {} as never;
const attendee = { id: 5, role: ROLES.ATTENDEE };
const RELEASES = { version: 1 as const, releases: { "12": [4, 7] } };

// Event 12 ran 09:00-17:00 in the app zone on the 18th; "now" decides whether
// it has finished, and that is the whole trigger.
const TICKETED = [{ id: 12, event_date: "2026-08-18", end_time: "17:00" }];
const COURSE = {
  id: 30,
  course_name: "Intro",
  EVENT: { id: 12, title: "Demo Day", event_date: "2026-08-18" },
  MODULE: [
    { id: 1, LESSON: [] },
    { id: 4, LESSON: [{ id: 41 }] },
    { id: 7, LESSON: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date("2026-08-19T00:00:00Z"));
  getSetting.mockResolvedValue(RELEASES);
  userHasCourseAccess.mockResolvedValue(true);
  listEventWindowsByUser.mockResolvedValue(TICKETED);
  listCourseSummaries.mockResolvedValue([COURSE]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveCourseGrant", () => {
  it("admits staff on role alone, without touching the database", async () => {
    const grant = await resolveCourseGrant(db, { id: 9, role: ROLES.FACILITATOR }, 30);

    expect(grant).toBe("staff");
    expect(userHasCourseAccess).not.toHaveBeenCalled();
  });

  it("admits a ticket holder to their event's course", async () => {
    await expect(resolveCourseGrant(db, attendee, 30)).resolves.toBe("live");
  });

  it("refuses someone with neither a ticket nor a speaker assignment", async () => {
    userHasCourseAccess.mockResolvedValue(false);

    await expect(resolveCourseGrant(db, attendee, 30)).resolves.toBeNull();
  });

  it("does not consult the release map, which decides modules rather than access", async () => {
    // Holding the course and being able to read all of it are separate
    // questions; conflating them is what would hide a whole course by mistake.
    await resolveCourseGrant(db, attendee, 30);

    expect(getSetting).not.toHaveBeenCalled();
  });
});

describe("listReleasedCourses", () => {
  it("lists a course once the event holding its modules back has finished", async () => {
    const courses = await listReleasedCourses(db, 5);

    expect(listEventWindowsByUser).toHaveBeenCalledWith(db, 5, [12]);
    expect(listCourseSummaries).toHaveBeenCalledWith(db, { eventIds: [12] });
    expect(courses).toHaveLength(1);
  });

  it("counts only the released modules, not the whole curriculum", async () => {
    // The card leads to the released material, so a count of everything the
    // course contains would promise modules the reader cannot open.
    const [course] = await listReleasedCourses(db, 5);

    expect(course.MODULE.map((mod) => mod.id)).toEqual([4, 7]);
  });

  it("lists nothing while the event is still running", async () => {
    vi.setSystemTime(new Date("2026-08-18T08:59:00Z"));

    await expect(listReleasedCourses(db, 5)).resolves.toEqual([]);
    expect(listCourseSummaries).not.toHaveBeenCalled();
  });

  it("releases it the minute the event ends", async () => {
    vi.setSystemTime(new Date("2026-08-18T09:01:00Z"));

    await expect(listReleasedCourses(db, 5)).resolves.toHaveLength(1);
  });

  it("lists nothing for someone holding no ticket to a releasing event", async () => {
    listEventWindowsByUser.mockResolvedValue([]);

    await expect(listReleasedCourses(db, 5)).resolves.toEqual([]);
  });

  it("reads no tickets at all when nothing anywhere is held back", async () => {
    getSetting.mockResolvedValue({ version: 1, releases: {} });

    await expect(listReleasedCourses(db, 5)).resolves.toEqual([]);
    expect(listEventWindowsByUser).not.toHaveBeenCalled();
  });

  it("holds back nothing extra when the map is unreadable", async () => {
    // getSetting falls back to an empty map on a malformed row, so a settings
    // row nobody can parse releases nothing rather than everything.
    getSetting.mockResolvedValue({ version: 1, releases: {} });

    await expect(listReleasedCourses(db, 5)).resolves.toEqual([]);
  });
});
