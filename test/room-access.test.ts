import { describe, it, expect } from "vitest";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";

interface AccessData {
  hasTicket: boolean;
  isSpeakerAssigned: boolean;
}

function canAccessRoom(userRole: UserRole | null, accessData: AccessData): "allowed" | "no_ticket" | "denied" {
  const speakerAssigned = userRole === "speaker" ? accessData.isSpeakerAssigned : true;
  if (!speakerAssigned) return "denied";

  const hasTicketOrBypass = hasMinRole(userRole, "facilitator") || accessData.hasTicket || accessData.isSpeakerAssigned;
  if (!hasTicketOrBypass) return "no_ticket";

  return "allowed";
}

describe("Room access — speaker ticket bypass", () => {
  describe("speaker assigned to event (no ticket)", () => {
    const data: AccessData = { hasTicket: false, isSpeakerAssigned: true };

    it("allows access to assigned speaker without ticket", () => {
      expect(canAccessRoom("speaker", data)).toBe("allowed");
    });
  });

  describe("speaker NOT assigned to event", () => {
    const data: AccessData = { hasTicket: false, isSpeakerAssigned: false };

    it("denies access to unassigned speaker", () => {
      expect(canAccessRoom("speaker", data)).toBe("denied");
    });
  });

  describe("speaker assigned with ticket", () => {
    const data: AccessData = { hasTicket: true, isSpeakerAssigned: true };

    it("allows access via ticket", () => {
      expect(canAccessRoom("speaker", data)).toBe("allowed");
    });
  });

  describe("attendee with valid ticket", () => {
    const data: AccessData = { hasTicket: true, isSpeakerAssigned: false };

    it("allows access", () => {
      expect(canAccessRoom("attendee", data)).toBe("allowed");
    });
  });

  describe("attendee without ticket", () => {
    const data: AccessData = { hasTicket: false, isSpeakerAssigned: false };

    it("shows no_ticket", () => {
      expect(canAccessRoom("attendee", data)).toBe("no_ticket");
    });
  });

  describe("facilitator without ticket", () => {
    const data: AccessData = { hasTicket: false, isSpeakerAssigned: false };

    it("bypasses ticket check via role", () => {
      expect(canAccessRoom("facilitator", data)).toBe("allowed");
    });
  });

  describe("admin without ticket", () => {
    const data: AccessData = { hasTicket: false, isSpeakerAssigned: false };

    it("bypasses ticket check via role", () => {
      expect(canAccessRoom("admin", data)).toBe("allowed");
    });
  });

  describe("anonymous user", () => {
    const data: AccessData = { hasTicket: false, isSpeakerAssigned: false };

    it("is denied", () => {
      expect(canAccessRoom(null, data)).toBe("no_ticket");
    });
  });
});
