import { describe, it, expect } from "vitest";
import {
  eventSchema,
  speakerProfileSchema,
  speakerProfileUpdateSchema,
  speakerAssignmentSchema,
} from "@/modules/event-management";
import type { Event, SpeakerProfile } from "@/types";

describe("Event types", () => {
  it("Event interface has correct shape", () => {
    const event: Event = {
      event_id: 1,
      course_id: null,
      title: "Test Event",
      event_date: "2026-06-15",
      start_time: "09:00:00",
      end_time: "17:00:00",
      venue_name: "Convention Center",
      venue_address: "123 Main St",
      lat: null,
      lng: null,
      price: 0,
      currency: "PHP",
      status: "draft",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(event.title).toBe("Test Event");
    expect(event.event_date).toBe("2026-06-15");
  });

  it("SpeakerProfile interface has correct shape", () => {
    const profile: SpeakerProfile = {
      speaker_profile_id: 1,
      user_id: 1,
      bio: "Expert speaker",
      photo_url: null,
      designation: "Keynote",
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
      lat: 1.234,
      lng: 5.678,
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
