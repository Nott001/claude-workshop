// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { CoverImageUpload } from "@/modules/events/components/cover-image-upload";
import {
  acceptAttribute,
  maxSizeMb,
  validateFileSize,
  validateSourceSize,
  validateFileType,
} from "@/shared/integrations/storage/policy";
import { resizeImage } from "@/shared/integrations/storage/resize-image";

// Passthrough by default so every assertion below still sees the file it picked.
vi.mock("@/shared/integrations/storage/resize-image", () => ({
  resizeImage: vi.fn(async (file: File) => file),
}));

function pick(file: File) {
  const input = document.getElementById("event-cover-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

function imageFile(name = "cover.png", type = "image/png", size = 1024) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CoverImageUpload", () => {
  it("posts the file and the event id the route requires", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ url: "/api/storage/event_images/events/7/cover.png" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoverImageUpload eventId="7" initialUrl={null} />);
    pick(imageFile());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/upload/event-image");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("event_id")).toBe("7");
    expect((body.get("file") as File).name).toBe("cover.png");
  });

  it("posts the shrunk file, not the one the user picked", async () => {
    // Resizing moved to the browser when the worker proved unable to do it, so
    // the request must carry the resizer's output rather than the input.
    const shrunk = new File(["s"], "shrunk.png", { type: "image/png" });
    vi.mocked(resizeImage).mockResolvedValueOnce(shrunk);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "/x" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoverImageUpload eventId="7" initialUrl={null} />);
    pick(imageFile());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect((body.get("file") as File).name).toBe("shrunk.png");
  });

  it("shows the uploaded cover and tells the page about it", async () => {
    const uploaded = "/api/storage/event_images/events/7/cover.png";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: uploaded }) }));
    const onUploaded = vi.fn();

    render(<CoverImageUpload eventId="7" initialUrl={null} onUploaded={onUploaded} />);
    expect(screen.getByText("No cover image yet")).toBeTruthy();

    pick(imageFile());

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(uploaded));
    expect(screen.getByAltText("Event cover").getAttribute("src")).toBe(uploaded);
  });

  it("rejects a disallowed type without spending the round trip", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CoverImageUpload eventId="7" initialUrl={null} />);
    pick(imageFile("notes.pdf", "application/pdf"));

    expect(await screen.findByText("Only JPEG and PNG images are allowed.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized file without spending the round trip", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CoverImageUpload eventId="7" initialUrl={null} />);
    pick(imageFile("huge.png", "image/png", 51 * 1024 * 1024));

    expect(await screen.findByText(`Image must be under ${maxSizeMb("event_images")} MB.`)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the route's own error rather than a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Failed to update event cover image" }) }),
    );

    render(<CoverImageUpload eventId="7" initialUrl={null} />);
    pick(imageFile());

    expect(await screen.findByText("Failed to update event cover image")).toBeTruthy();
  });

  it("keeps showing the existing cover when a replacement fails", async () => {
    const existing = "/api/storage/event_images/events/7/cover.jpg";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Upload failed" }) }));

    render(<CoverImageUpload eventId="7" initialUrl={existing} />);
    pick(imageFile());

    expect(await screen.findByText("Upload failed")).toBeTruthy();
    expect(screen.getByAltText("Event cover").getAttribute("src")).toBe(existing);
  });
});

describe("storage policy shared with the upload route", () => {
  it("offers the file input the same types the bucket accepts", () => {
    expect(acceptAttribute("event_images")).toBe("image/jpeg,image/png");
  });

  it("agrees with the route on what event_images allows", () => {
    expect(validateFileType("event_images", "image/png")).toBe(true);
    expect(validateFileType("event_images", "application/pdf")).toBe(false);
    // The picker and the route measure different things: the reader may choose
    // up to the source limit, and the route bounds what survives the resize.
    expect(validateSourceSize("event_images", 50 * 1024 * 1024)).toBe(true);
    expect(validateSourceSize("event_images", 50 * 1024 * 1024 + 1)).toBe(false);
    expect(validateFileSize("event_images", 1024 * 1024)).toBe(true);
  });
});
