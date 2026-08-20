import { describe, it, expect } from "vitest";
import {
  buildEventImagePath,
  buildEventPhotoPath,
  eventPhotoFolder,
  sanitizeObjectName,
} from "@/shared/integrations/storage/policy";

describe("sanitizeObjectName", () => {
  it("keeps a plain filename", () => {
    expect(sanitizeObjectName("slides.pdf", "asset.bin")).toBe("slides.pdf");
  });

  it("keeps the final segment of a posix path", () => {
    expect(sanitizeObjectName("../../1/lessons/2/evil.pdf", "asset.bin")).toBe("evil.pdf");
  });

  it("keeps the final segment of a windows path", () => {
    expect(sanitizeObjectName("C:\\lessons\\leak.mp4", "video.bin")).toBe("leak.mp4");
  });

  it("falls back for a name that is only dots", () => {
    expect(sanitizeObjectName("..", "asset.bin")).toBe("asset.bin");
    expect(sanitizeObjectName("....", "asset.bin")).toBe("asset.bin");
  });

  it("falls back for an empty or absent name", () => {
    expect(sanitizeObjectName("", "asset.bin")).toBe("asset.bin");
    expect(sanitizeObjectName("/", "asset.bin")).toBe("asset.bin");
  });
});

describe("event photo paths", () => {
  it("sits under the event prefix the storage route resolves access from", () => {
    // `/api/storage/event_images/events/{id}/...` is read as "belongs to event
    // {id}", which is what makes a published event's photo public without a
    // second rule to keep in step.
    expect(buildEventPhotoPath(7, "jpg").startsWith("events/7/")).toBe(true);
  });

  it("never collides with the event's cover", () => {
    expect(buildEventPhotoPath(7, "png")).not.toBe(buildEventImagePath(7, "png"));
  });

  it("gives every upload its own key, so concurrent picks cannot overwrite each other", () => {
    const keys = new Set(Array.from({ length: 200 }, () => buildEventPhotoPath(7, "jpg")));

    // A clock- or count-derived name collides here: several files are picked at
    // once and uploaded in the same millisecond.
    expect(keys.size).toBe(200);
  });

  it("keeps the extension it was given", () => {
    expect(buildEventPhotoPath(7, "png").endsWith(".png")).toBe(true);
  });

  it("agrees with the folder the cleanup sweeps", () => {
    expect(buildEventPhotoPath(7, "jpg").startsWith(`${eventPhotoFolder(7)}/`)).toBe(true);
  });
});
