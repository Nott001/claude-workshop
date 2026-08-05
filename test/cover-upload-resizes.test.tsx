// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CoverImageUpload } from "@/modules/events/components/cover-image-upload";

const shrunk = new File([new Uint8Array(8)], "shrunk.jpg", { type: "image/jpeg" });

vi.mock("@/shared/integrations/storage/resize-image", () => ({
  resizeImage: vi.fn(async () => shrunk),
}));

const original = () => new File([new Uint8Array(4096)], "camera-roll.jpg", { type: "image/jpeg" });

function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

/** The File the component actually posted, read back out of the request body. */
function postedFile(fetchMock: ReturnType<typeof vi.fn>): File {
  const body = fetchMock.mock.calls[0][1].body as FormData;
  return body.get("file") as File;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "/api/storage/event_images/events/7/cover.jpg" })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("cover upload", () => {
  // The sweep next door proves the call is written. This proves it runs: a
  // resize that throws, returns late, or is wired to the wrong variable would
  // still read correctly in the source.
  it("posts the shrunk file, not the one the user picked", async () => {
    const { container } = render(<CoverImageUpload eventId="7" initialUrl={null} />);

    fireEvent.change(fileInput(container), { target: { files: [original()] } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(postedFile(fetchMock).name).toBe("shrunk.jpg");
  });

  it("posts to the upload route with the event it belongs to", async () => {
    const { container } = render(<CoverImageUpload eventId="7" initialUrl={null} />);

    fireEvent.change(fileInput(container), { target: { files: [original()] } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/upload/event-image");
    expect((init.body as FormData).get("event_id")).toBe("7");
  });

  it("never reaches the network for a file the bucket refuses", async () => {
    const { container } = render(<CoverImageUpload eventId="7" initialUrl={null} />);
    const gif = new File([new Uint8Array(8)], "animation.gif", { type: "image/gif" });

    fireEvent.change(fileInput(container), { target: { files: [gif] } });

    await waitFor(() => expect(container.textContent).toContain("Only JPEG and PNG"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
