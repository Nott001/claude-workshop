import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateFileType,
  validateFileSize,
  getExtensionFromMimeType,
  buildEventImagePath,
  buildProfileImagePath,
  buildCourseAssetPath,
  buildCourseVideoPath,
  isStorageBucket,
} from "@/shared/integrations/storage/policy";
import { uploadToStorage, deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import type { Event, User } from "@/shared/types";

const bucket = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), list: vi.fn() }));

// The storage helpers import the service client lazily, inside each call.
vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ storage: { from: () => bucket } }),
}));

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

describe("Storage operations", () => {
  beforeEach(() => {
    bucket.upload.mockReset();
    bucket.remove.mockReset();
    bucket.list.mockReset();
  });

  it("isStorageBucket accepts a served bucket and rejects anything else", () => {
    expect(isStorageBucket("event_images")).toBe(true);
    expect(isStorageBucket("../secrets")).toBe(false);
  });

  it("uploadToStorage returns the proxy URL rather than a public one", async () => {
    bucket.upload.mockResolvedValue({ error: null });

    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    const result = await uploadToStorage("event_images", "events/1/cover.jpg", file);

    // Entitlement is enforced by /api/storage, so a bypassable public URL would
    // defeat the check the proxy exists to perform.
    expect(result.url).toBe("/api/storage/event_images/events/1/cover.jpg");
    expect(result.path).toBe("events/1/cover.jpg");
  });

  it("uploadToStorage throws when the upload fails", async () => {
    bucket.upload.mockResolvedValue({ error: { message: "quota exceeded" } });

    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    await expect(uploadToStorage("event_images", "events/1/cover.jpg", file)).rejects.toThrow("quota exceeded");
  });

  it("deleteFromStorage makes no call for an empty path list", async () => {
    await deleteFromStorage("event_images", []);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("deleteFromStorage removes every path given", async () => {
    bucket.remove.mockResolvedValue({ error: null });

    await deleteFromStorage("course_assets", ["a.pdf", "b.pdf"]);

    expect(bucket.remove).toHaveBeenCalledWith(["a.pdf", "b.pdf"]);
  });

  it("listStorageFolder qualifies each entry with its folder", async () => {
    bucket.list.mockResolvedValue({ data: [{ name: "one.pdf" }, { name: "two.pdf" }], error: null });

    const files = await listStorageFolder("course_assets", "courses/1");

    expect(files).toEqual(["courses/1/one.pdf", "courses/1/two.pdf"]);
  });

  it("listStorageFolder returns nothing when the listing fails", async () => {
    bucket.list.mockResolvedValue({ data: null, error: { message: "no such folder" } });

    expect(await listStorageFolder("course_assets", "courses/999")).toEqual([]);
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
