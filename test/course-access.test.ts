import { describe, it, expect, vi, beforeEach } from "vitest";

const { findCourseEvent, findCourseByModule, findCourseByLesson, checkAssignment, isAssignedByUserId } = vi.hoisted(() => ({
  findCourseEvent: vi.fn(),
  findCourseByModule: vi.fn(),
  findCourseByLesson: vi.fn(),
  checkAssignment: vi.fn(),
  isAssignedByUserId: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({ findCourseEvent, findCourseByModule, findCourseByLesson }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ checkAssignment }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ isAssignedByUserId }));

import {
  canManageEvent,
  requireCourseAccess,
  requireModuleAccess,
  requireLessonAccess,
  requireCourseDeleteAccess,
} from "@/modules/courses/lib/course-access";

const client = {} as unknown as Parameters<typeof canManageEvent>[0];

// The course's event is 100 no matter which id resolves: course 1, module 2 or
// lesson 3 all hang off it, matching the DAO contract `{ id, event_id }`.
const assigned = { id: 1, event_id: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  findCourseEvent.mockResolvedValue(assigned);
  findCourseByModule.mockResolvedValue(assigned);
  findCourseByLesson.mockResolvedValue(assigned);
  checkAssignment.mockResolvedValue(false);
  isAssignedByUserId.mockResolvedValue(false);
});

describe("canManageEvent", () => {
  it("admits admins globally without consulting assignments", async () => {
    expect(await canManageEvent(client, 1, "admin", 100)).toBe(true);
    expect(await canManageEvent(client, 1, "super_admin", 100)).toBe(true);
    expect(checkAssignment).not.toHaveBeenCalled();
    expect(isAssignedByUserId).not.toHaveBeenCalled();
  });

  it("admits a facilitator assigned to the event", async () => {
    checkAssignment.mockResolvedValue(true);
    expect(await canManageEvent(client, 7, "facilitator", 100)).toBe(true);
    expect(checkAssignment).toHaveBeenCalledWith(client, 7, 100);
  });

  it("admits a speaker assigned to the event", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    expect(await canManageEvent(client, 8, "speaker", 100)).toBe(true);
    expect(isAssignedByUserId).toHaveBeenCalledWith(client, 8, 100);
  });

  it("denies an unassigned facilitator or speaker", async () => {
    expect(await canManageEvent(client, 7, "facilitator", 100)).toBe(false);
    expect(await canManageEvent(client, 8, "speaker", 100)).toBe(false);
  });

  it("denies an attendee without querying assignments", async () => {
    expect(await canManageEvent(client, 5, "attendee", 100)).toBe(false);
    expect(checkAssignment).not.toHaveBeenCalled();
    expect(isAssignedByUserId).not.toHaveBeenCalled();
  });
});

describe("author-content access (course / module / lesson)", () => {
  const rows = [
    { name: "requireCourseAccess", fn: requireCourseAccess, id: 1 },
    { name: "requireModuleAccess", fn: requireModuleAccess, id: 2 },
    { name: "requireLessonAccess", fn: requireLessonAccess, id: 3 },
  ];

  for (const { name, fn, id } of rows) {
    it(`${name} allows an admin`, async () => {
      expect(await fn(id, 1, "admin")).toBeNull();
    });

    it(`${name} allows an assigned facilitator`, async () => {
      checkAssignment.mockResolvedValue(true);
      expect(await fn(id, 7, "facilitator")).toBeNull();
    });

    it(`${name} allows an assigned speaker`, async () => {
      isAssignedByUserId.mockResolvedValue(true);
      expect(await fn(id, 8, "speaker")).toBeNull();
    });

    it(`${name} 403s an unassigned facilitator or speaker`, async () => {
      expect(await fn(id, 7, "facilitator")).toMatchObject({ status: 403 });
      expect(await fn(id, 8, "speaker")).toMatchObject({ status: 403 });
    });

    it(`${name} 403s an attendee`, async () => {
      expect(await fn(id, 5, "attendee")).toMatchObject({ status: 403 });
    });

    it(`${name} 404s an unknown id rather than 403`, async () => {
      findCourseEvent.mockResolvedValue(null);
      findCourseByModule.mockResolvedValue(null);
      findCourseByLesson.mockResolvedValue(null);
      expect(await fn(id, 7, "facilitator")).toMatchObject({ status: 404 });
    });

    it(`${name} uses a course and client passed in without re-querying`, async () => {
      checkAssignment.mockResolvedValue(true);
      const passed = {} as unknown as Parameters<typeof canManageEvent>[0];
      const res = await fn(id, 7, "facilitator", { supabase: passed, course: assigned });
      expect(res).toBeNull();
      expect(findCourseByModule).not.toHaveBeenCalled();
      expect(findCourseByLesson).not.toHaveBeenCalled();
      expect(findCourseEvent).not.toHaveBeenCalled();
      expect(checkAssignment).toHaveBeenCalledWith(passed, 7, 100);
    });

    it(`${name} treats a passed null course as a 404 without querying`, async () => {
      const res = await fn(id, 7, "facilitator", { course: null });
      expect(res).toMatchObject({ status: 404 });
      expect(findCourseByModule).not.toHaveBeenCalled();
      expect(findCourseByLesson).not.toHaveBeenCalled();
      expect(findCourseEvent).not.toHaveBeenCalled();
    });
  }
});

describe("requireCourseDeleteAccess", () => {
  it("allows an admin even when unassigned", async () => {
    expect(await requireCourseDeleteAccess(1, 1, "admin")).toBeNull();
    expect(await requireCourseDeleteAccess(1, 1, "super_admin")).toBeNull();
    expect(checkAssignment).not.toHaveBeenCalled();
  });

  it("allows a facilitator assigned to the event", async () => {
    checkAssignment.mockResolvedValue(true);
    expect(await requireCourseDeleteAccess(1, 7, "facilitator")).toBeNull();
    expect(checkAssignment).toHaveBeenCalledWith(client, 7, 100);
  });

  it("403s an unassigned facilitator", async () => {
    expect(await requireCourseDeleteAccess(1, 7, "facilitator")).toMatchObject({ status: 403 });
  });

  it("403s an assigned speaker without querying", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    expect(await requireCourseDeleteAccess(1, 8, "speaker")).toMatchObject({ status: 403 });
    expect(isAssignedByUserId).not.toHaveBeenCalled();
  });

  it("403s an attendee without querying", async () => {
    expect(await requireCourseDeleteAccess(1, 5, "attendee")).toMatchObject({ status: 403 });
    expect(checkAssignment).not.toHaveBeenCalled();
  });

  it("404s an unknown course rather than 403", async () => {
    findCourseEvent.mockResolvedValue(null);
    expect(await requireCourseDeleteAccess(99, 7, "facilitator")).toMatchObject({ status: 404 });
  });
});
