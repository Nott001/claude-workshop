import { describe, it, expect } from "vitest";
import {
  eventSchema,
  speakerProfileSchema,
  speakerProfileUpdateSchema,
  speakerAssignmentSchema,
} from "@/modules/events/lib/schemas";
import type { Event, SpeakerProfile } from "@/shared/types";

describe("Event types", () => {
  it("Event interface has correct shape", () => {
    const event: Event = {
      id: 1,
      course_id: null,
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00:00",
      end_time: "17:00:00",
      venue_name: "Convention Center",
      venue_address: "123 Main St",
      price: 0,
      currency: "PHP",
      cover_image_url: null,
      status: "draft",
      description: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(event.title).toBe("Test Event");
    expect(event.event_date).toBe("2026-06-15");
  });

  it("SpeakerProfile interface has correct shape", () => {
    const profile: SpeakerProfile = {
      id: 1,
      user_id: 1,
      bio: "Expert speaker",
      designation: "Keynote",
      linkedin_url: null,
      twitter_url: null,
      github_url: null,
      website_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(profile.bio).toBe("Expert speaker");
    expect(profile.designation).toBe("Keynote");
  });
});

describe("eventSchema", () => {
  it("accepts valid event data", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
    });
    expect(result.success).toBe(true);
  });

  it("accepts event with optional fields", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
      venue_address: "123 Main St",
      course_id: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts event with cover_image_url", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
      cover_image_url: "https://storage.example.com/event_images/events/1/cover.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts event with null cover_image_url", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
      cover_image_url: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts relative cover_image_url (storage proxy path)", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
      cover_image_url: "not-a-url",
    });
    expect(result.success).toBe(true);
  });

  it("rejects end_time before start_time", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "17:00",
      end_time: "09:00",
      venue_name: "Convention Center",
    });
    expect(result.success).toBe(false);
  });

  it("accepts event with explicit status", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
      status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = eventSchema.safeParse({
      title: "",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Convention Center",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty venue_name", () => {
    const result = eventSchema.safeParse({
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("speakerProfileSchema", () => {
  it("accepts valid speaker profile", () => {
    const result = speakerProfileSchema.safeParse({
      user_id: 1,
      bio: "Expert speaker",
      designation: "Keynote",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal speaker profile", () => {
    const result = speakerProfileSchema.safeParse({ user_id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing user_id", () => {
    const result = speakerProfileSchema.safeParse({ bio: "Expert" });
    expect(result.success).toBe(false);
  });
});

describe("speakerProfileUpdateSchema", () => {
  it("accepts partial update", () => {
    const result = speakerProfileUpdateSchema.safeParse({ bio: "Updated bio" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = speakerProfileUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("Event filter logic", () => {
  const events = [
    { event_id: 1, status: "active" as const },
    { event_id: 2, status: "draft" as const },
    { event_id: 3, status: "complete" as const },
    { event_id: 4, status: "active" as const },
  ];

  function filterEvents(events: { event_id: number; status: string }[], tab: string) {
    return events.filter((event) => {
      switch (tab) {
        case "upcoming":
          return event.status === "active";
        case "completed":
          return event.status === "complete";
        case "drafts":
          return event.status === "draft";
        default:
          return true;
      }
    });
  }

  it("upcoming tab shows only active events", () => {
    const result = filterEvents(events, "upcoming");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.status === "active")).toBe(true);
  });

  it("completed tab shows only complete events", () => {
    const result = filterEvents(events, "completed");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("complete");
  });

  it("drafts tab shows only draft events", () => {
    const result = filterEvents(events, "drafts");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("draft");
  });

  it("upcoming tab never includes draft events", () => {
    const result = filterEvents(events, "upcoming");
    expect(result.some((e) => e.status === "draft")).toBe(false);
  });
});

describe("speakerAssignmentSchema", () => {
  it("accepts valid speaker assignment", () => {
    const result = speakerAssignmentSchema.safeParse({ speaker_profile_id: "1" });
    expect(result.success).toBe(true);
  });

  it("rejects missing speaker_profile_id", () => {
    const result = speakerAssignmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
