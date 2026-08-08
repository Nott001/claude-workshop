import { describe, it, expect } from "vitest";
import { canAccessCourseRoom } from "@/modules/courses/lib/room-access-policy";

// This file used to re-declare the rule locally, so every case below passed no
// matter what the product code did — deleting the speaker bypass left the suite
// green. It imports the real gate now.
describe("Course room access — speaker ticket bypass", () => {
  it("allows an assigned speaker holding no ticket", () => {
    expect(canAccessCourseRoom("speaker", { hasTicket: false, isSpeakerAssigned: true })).toBe("allowed");
  });

  it("denies an unassigned speaker", () => {
    expect(canAccessCourseRoom("speaker", { hasTicket: false, isSpeakerAssigned: false })).toBe("denied");
  });

  it("allows an assigned speaker who also holds a ticket", () => {
    expect(canAccessCourseRoom("speaker", { hasTicket: true, isSpeakerAssigned: true })).toBe("allowed");
  });

  it("denies an unassigned speaker even with a ticket — assignment gates the room", () => {
    expect(canAccessCourseRoom("speaker", { hasTicket: true, isSpeakerAssigned: false })).toBe("denied");
  });
});

describe("Course room access — everyone else", () => {
  it("allows an attendee with a valid ticket", () => {
    expect(canAccessCourseRoom("attendee", { hasTicket: true, isSpeakerAssigned: false })).toBe("allowed");
  });

  it("turns away an attendee without a ticket", () => {
    expect(canAccessCourseRoom("attendee", { hasTicket: false, isSpeakerAssigned: false })).toBe("no_ticket");
  });

  it("lets a facilitator in on role alone", () => {
    expect(canAccessCourseRoom("facilitator", { hasTicket: false, isSpeakerAssigned: false })).toBe("allowed");
  });

  it("lets an admin in on role alone", () => {
    expect(canAccessCourseRoom("admin", { hasTicket: false, isSpeakerAssigned: false })).toBe("allowed");
  });

  it("turns away a caller with no role", () => {
    expect(canAccessCourseRoom(null, { hasTicket: false, isSpeakerAssigned: false })).toBe("no_ticket");
  });
});
