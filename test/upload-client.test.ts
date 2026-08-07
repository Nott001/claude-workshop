import { describe, it, expect, vi, afterEach } from "vitest";
import { postUpload } from "@/shared/integrations/storage/upload-client";
import { maxSizeMb } from "@/shared/integrations/storage/policy";

const shrunk = new File(["s"], "shrunk.jpg", { type: "image/jpeg" });

vi.mock("@/shared/integrations/storage/resize-image", () => ({
  resizeImage: vi.fn(async () => shrunk),
}));

function sized(file: File, bytes: number) {
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

const photo = () => new File(["x"], "camera-roll.jpg", { type: "image/jpeg" });
const ok = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/api/storage/x" }) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("postUpload", () => {
  it("shrinks the file before posting it", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await postUpload("event_images", "/api/upload/event-image", photo());

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect((body.get("file") as File).name).toBe("shrunk.jpg");
  });

  it("carries the extra fields the route needs", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    await postUpload("event_images", "/api/upload/event-image", photo(), { event_id: "7" });

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("event_id")).toBe("7");
  });

  // This is the behaviour the helper exists for: it used to happen at one of
  // three call sites, so a wrong-typed profile photo or lesson video paid a
  // full round trip to be told what the bucket already knew.
  it("refuses a type the bucket does not take, without a request", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);
    const pdf = new File(["x"], "notes.pdf", { type: "application/pdf" });

    const result = await postUpload("profile_images", "/api/upload/profile-image", pdf);

    expect(result).toEqual({ ok: false, error: "Only JPEG and PNG images are allowed." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an oversized file, without a request", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);

    const result = await postUpload(
      "course_videos",
      "/api/upload/course-video",
      sized(new File(["x"], "big.mp4", { type: "video/mp4" }), 51 * 1024 * 1024),
    );

    expect(result).toEqual({ ok: false, error: `Video must be under ${maxSizeMb("course_videos")} MB.` });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the bucket's own rule when it refuses", async () => {
    vi.stubGlobal("fetch", ok());
    const png = new File(["x"], "diagram.png", { type: "image/png" });

    // A PNG is fine for a cover and wrong for the video bucket; the message has
    // to follow the bucket rather than the file.
    const result = await postUpload("course_videos", "/api/upload/course-video", png);

    expect(result).toEqual({ ok: false, error: "Only MP4, WebM, MOV, AVI and MKV videos are allowed." });
  });

  it("passes the route's own error through rather than a generic one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Event not found" }) }));

    const result = await postUpload("event_images", "/api/upload/event-image", photo());

    expect(result).toEqual({ ok: false, error: "Event not found" });
  });

  it("reports a failure rather than throwing when the request never lands", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(postUpload("event_images", "/api/upload/event-image", photo())).resolves.toEqual({
      ok: false,
      error: "Could not upload the file.",
    });
  });

  it("returns the stored url on success", async () => {
    vi.stubGlobal("fetch", ok());

    await expect(postUpload("event_images", "/api/upload/event-image", photo())).resolves.toEqual({
      ok: true,
      url: "/api/storage/x",
    });
  });
});
