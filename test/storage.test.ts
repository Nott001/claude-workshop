import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  validateFileType,
  validateFileSize,
  getExtensionFromMimeType,
  buildEventImagePath,
  buildProfileImagePath,
  buildCourseAssetPath,
  buildCourseVideoPath,
} from "@/shared/integrations/storage";
import type { Event, User } from "@/shared/types";

describe("Storage bucket validation", () => {
  describe("validateFileType", () => {
    it("accepts JPEG for event_images", () => {
      expect(validateFileType("event_images", "image/jpeg")).toBe(true);
    });

    it("accepts PNG for event_images", () => {
      expect(validateFileType("event_images", "image/png")).toBe(true);
    });

    it("rejects GIF for event_images", () => {
      expect(validateFileType("event_images", "image/gif")).toBe(false);
    });

    it("accepts PDF for course_assets", () => {
      expect(validateFileType("course_assets", "application/pdf")).toBe(true);
    });

    it("accepts PPTX for course_assets", () => {
      expect(
        validateFileType("course_assets", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
      ).toBe(true);
    });

    it("accepts MP4 for course_videos", () => {
      expect(validateFileType("course_videos", "video/mp4")).toBe(true);
    });

    it("accepts WebM for course_videos", () => {
      expect(validateFileType("course_videos", "video/webm")).toBe(true);
    });

    it("rejects PDF for course_videos", () => {
      expect(validateFileType("course_videos", "application/pdf")).toBe(false);
    });

    it("accepts JPEG for profile_images", () => {
      expect(validateFileType("profile_images", "image/jpeg")).toBe(true);
    });

    it("rejects video for profile_images", () => {
      expect(validateFileType("profile_images", "video/mp4")).toBe(false);
    });
  });

  describe("validateFileSize", () => {
    it("accepts files under 50MB", () => {
      expect(validateFileSize("event_images", 1024 * 1024)).toBe(true);
    });

    it("accepts files exactly 50MB", () => {
      expect(validateFileSize("event_images", 50 * 1024 * 1024)).toBe(true);
    });

    it("rejects files over 50MB", () => {
      expect(validateFileSize("event_images", 51 * 1024 * 1024)).toBe(false);
    });
  });

  describe("getExtensionFromMimeType", () => {
    it("returns jpg for image/jpeg", () => {
      expect(getExtensionFromMimeType("image/jpeg")).toBe("jpg");
    });

    it("returns png for image/png", () => {
      expect(getExtensionFromMimeType("image/png")).toBe("png");
    });

    it("returns pdf for application/pdf", () => {
      expect(getExtensionFromMimeType("application/pdf")).toBe("pdf");
    });

    it("returns mp4 for video/mp4", () => {
      expect(getExtensionFromMimeType("video/mp4")).toBe("mp4");
    });

    it("returns bin for unknown types", () => {
      expect(getExtensionFromMimeType("application/octet-stream")).toBe("bin");
    });
  });
});

describe("Storage path builders", () => {
  it("buildEventImagePath creates correct path", () => {
    expect(buildEventImagePath(1, "jpg")).toBe("events/1/cover.jpg");
  });

  it("buildProfileImagePath creates correct path", () => {
    const path = buildProfileImagePath(42, "png");
    expect(path).toMatch(/^users\/42\/profile_\d+\.png$/);
  });

  it("buildCourseAssetPath creates correct path", () => {
    expect(buildCourseAssetPath(1, 2, 3, "slides.pdf")).toBe("courses/1/modules/2/lessons/3/slides.pdf");
  });

  it("buildCourseVideoPath creates correct path", () => {
    expect(buildCourseVideoPath(1, 2, 3, "lecture.mp4")).toBe("courses/1/modules/2/lessons/3/lecture.mp4");
  });
});

describe("optimizeImage", () => {
  it("passes non-image files through unchanged", async () => {
    const { optimizeImage } = await import("@/shared/integrations/storage/optimize");

    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const optimized = await optimizeImage(file);

    expect(optimized.size).toBe(file.size);
    expect(optimized.type).toBe("text/plain");
  });

  it("compresses a JPEG image", async () => {
    const { optimizeImage } = await import("@/shared/integrations/storage/optimize");

    const buf = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } } })
      .jpeg()
      .toBuffer();
    const file = new File([buf], "test.jpg", { type: "image/jpeg" });
    const optimized = await optimizeImage(file);

    expect(optimized.type).toBe("image/jpeg");
    expect(optimized.size).toBeGreaterThan(0);
  });

  it("compresses a PNG image", async () => {
    const { optimizeImage } = await import("@/shared/integrations/storage/optimize");

    const buf = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
      .png()
      .toBuffer();
    const file = new File([buf], "test.png", { type: "image/png" });
    const optimized = await optimizeImage(file);

    expect(optimized.type).toBe("image/png");
    expect(optimized.size).toBeGreaterThan(0);
  });
});

describe("Type shapes", () => {
  it("Event has cover_image_url field", () => {
    const event: Event = {
      id: 1,
      title: "Test",
      event_date: "2026-01-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Venue",
      venue_address: null,
      price: 0,
      currency: "PHP",
      cover_image_url: null,
      status: "draft",
      description: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(event.cover_image_url).toBeNull();
  });

  it("User has profile_image_url field", () => {
    const user: User = {
      id: 1,
      full_name: "Test User",
      email: "test@example.com",
      auth_user_id: "clerk_123",
      role: "attendee",
      profile_image_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(user.profile_image_url).toBeNull();
  });
});
