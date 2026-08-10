import { ROLES } from "@/shared/lib/roles";
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

/** A JPEG carrying an EXIF block, since uploads now have their metadata removed. */
const EXIF = Array.from("Exif\0\0GPSLatitude 14.5995", (c) => c.charCodeAt(0));
const JPEG_WITH_EXIF = Uint8Array.from([
  0xff,
  0xd8,
  0xff,
  0xe1,
  ((EXIF.length + 2) >> 8) & 0xff,
  (EXIF.length + 2) & 0xff,
  ...EXIF,
  0xff,
  0xda,
  0x00,
  0x08,
  0x01,
  0x01,
  0x00,
  0x00,
  0x3f,
  0x00,
  0x12,
  0xff,
  0xd9,
]);

const jpegFile = () => new File([JPEG_WITH_EXIF as BlobPart], "cover.jpg", { type: "image/jpeg" });

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

    const result = await uploadToStorage("event_images", "events/1/cover.jpg", jpegFile());

    // Entitlement is enforced by /api/storage, so a bypassable public URL would
    // defeat the check the proxy exists to perform.
    expect(result.url).toBe("/api/storage/event_images/events/1/cover.jpg");
    expect(result.path).toBe("events/1/cover.jpg");
  });

  it("uploadToStorage throws when the upload fails", async () => {
    bucket.upload.mockResolvedValue({ error: { message: "quota exceeded" } });

    await expect(uploadToStorage("event_images", "events/1/cover.jpg", jpegFile())).rejects.toThrow("quota exceeded");
  });

  it("uploadToStorage strips metadata before the bytes reach the bucket", async () => {
    // The seam every upload passes through, so a bucket added later cannot be
    // wired up in a way that forgets this.
    bucket.upload.mockResolvedValue({ error: null });

    await uploadToStorage("profile_images", "users/1/profile.jpg", jpegFile());

    const stored = bucket.upload.mock.calls[0][1] as File;
    const bytes = new TextDecoder("latin1").decode(new Uint8Array(await stored.arrayBuffer()));
    expect(bytes).not.toContain("GPSLatitude");
    expect(stored.type).toBe("image/jpeg");
  });

  it("uploadToStorage still stores a file whose bytes are not the image it claims", async () => {
    // Stripping must not become a second gate on what may be uploaded; the
    // route's own type and size checks decide that.
    bucket.upload.mockResolvedValue({ error: null });
    const lying = new File(["not really a jpeg" as BlobPart], "cover.jpg", { type: "image/jpeg" });

    const result = await uploadToStorage("event_images", "events/1/cover.jpg", lying);

    expect(result.path).toBe("events/1/cover.jpg");
    expect(bucket.upload.mock.calls[0][1]).toBe(lying);
  });

  it("deleteFromStorage reports a failed removal without throwing", async () => {
    // Cleanup runs while deleting an event or course; throwing here would fail
    // the delete itself over files that are merely left behind.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    bucket.remove.mockResolvedValue({ error: { message: "object not found" } });

    await expect(deleteFromStorage("course_assets", ["a.pdf"])).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("listStorageFolder answers with no files when the listing fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    bucket.list.mockResolvedValue({ data: null, error: { message: "bucket missing" } });

    await expect(listStorageFolder("course_assets", "courses/1")).resolves.toEqual([]);
    logged.mockRestore();
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
      role: ROLES.ATTENDEE,
      profile_image_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(user.profile_image_url).toBeNull();
  });
});
