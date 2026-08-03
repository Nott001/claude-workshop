import { describe, it, expect } from "vitest";
import { canAccessRoom } from "@/modules/events/lib/room-access-policy";

// SPEC-00. This file used to re-declare `canAccessRoom` locally, so every case
// below passed no matter what the product code did — deleting the speaker
// bypass from `use-room-access.ts` left the suite green. It imports the real
// rule now.
describe("Room access — speaker ticket bypass", () => {
  it("allows an assigned speaker holding no ticket", () => {
    expect(canAccessRoom("speaker", { hasTicket: false, isSpeakerAssigned: true })).toBe("allowed");
  });

  it("denies an unassigned speaker", () => {
    expect(canAccessRoom("speaker", { hasTicket: false, isSpeakerAssigned: false })).toBe("denied");
  });

  it("allows an assigned speaker who also holds a ticket", () => {
    expect(canAccessRoom("speaker", { hasTicket: true, isSpeakerAssigned: true })).toBe("allowed");
  });

  it("denies an unassigned speaker even with a ticket — assignment gates the room", () => {
    expect(canAccessRoom("speaker", { hasTicket: true, isSpeakerAssigned: false })).toBe("denied");
  });
});

describe("Room access — everyone else", () => {
  it("allows an attendee with a valid ticket", () => {
    expect(canAccessRoom("attendee", { hasTicket: true, isSpeakerAssigned: false })).toBe("allowed");
  });

  it("turns away an attendee without a ticket", () => {
    expect(canAccessRoom("attendee", { hasTicket: false, isSpeakerAssigned: false })).toBe("no_ticket");
  });

  it("lets a facilitator in on role alone", () => {
    expect(canAccessRoom("facilitator", { hasTicket: false, isSpeakerAssigned: false })).toBe("allowed");
  });

  it("lets an admin in on role alone", () => {
    expect(canAccessRoom("admin", { hasTicket: false, isSpeakerAssigned: false })).toBe("allowed");
  });

  it("turns away a caller with no role", () => {
    expect(canAccessRoom(null, { hasTicket: false, isSpeakerAssigned: false })).toBe("no_ticket");
  });
});
