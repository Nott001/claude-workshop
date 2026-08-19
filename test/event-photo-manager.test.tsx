// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const { postUpload } = vi.hoisted(() => ({ postUpload: vi.fn() }));
vi.mock("@/shared/integrations/storage/upload-client", () => ({ postUpload }));

import { EventPhotoManager } from "@/modules/events/components/event-photo-manager";
import type { EventPhoto } from "@/shared/types";

const photo = (id: number, caption: string | null = null): EventPhoto => ({
  id,
  event_id: 7,
  image_url: `/api/storage/event_images/events/7/photos/${id}.jpg`,
  caption,
  sequence_order: id,
  created_at: "2026-05-01T00:00:00Z",
});

const file = (name: string) => new File(["x"], name, { type: "image/png" });

function pick(names: string[]) {
  const input = document.getElementById("event-photos-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: names.map(file), configurable: true });
  fireEvent.change(input);
}

let listed: EventPhoto[];

beforeEach(() => {
  vi.clearAllMocks();
  listed = [photo(1), photo(2)];
  postUpload.mockResolvedValue({ ok: true, url: "/x", data: photo(3) });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) return { ok: true, json: async () => ({ data: listed }) };
      return { ok: true, json: async () => photo(1, "Opening keynote") };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventPhotoManager", () => {
  it("shows the event's existing photos", async () => {
    render(<EventPhotoManager eventId="7" />);

    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(2));
  });

  it("invites an upload when there is nothing yet", async () => {
    listed = [];
    render(<EventPhotoManager eventId="7" />);

    expect(await screen.findByText("No photos yet")).toBeTruthy();
  });

  it("uploads several picked files one at a time", async () => {
    render(<EventPhotoManager eventId="7" />);
    await screen.findAllByAltText("Event photo");

    pick(["a.png", "b.png", "c.png"]);

    // Sequential, not concurrent: each file is held whole in a 128 MB isolate
    // shared by every request on it, and a phone's worth of photos at once is
    // how that runs out.
    await waitFor(() => expect(postUpload).toHaveBeenCalledTimes(3));
  });

  it("appends the uploaded row rather than re-reading the whole gallery", async () => {
    render(<EventPhotoManager eventId="7" />);
    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(2));

    pick(["a.png"]);

    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(3));
    // One GET on mount and no second one after the upload.
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(1);
  });

  it("summarises a partial failure instead of overwriting one message per file", async () => {
    render(<EventPhotoManager eventId="7" />);
    await screen.findAllByAltText("Event photo");

    postUpload.mockResolvedValueOnce({ ok: false, error: "too big" }).mockResolvedValueOnce({ ok: false, error: "too big" });

    pick(["a.png", "b.png", "c.png"]);

    expect(await screen.findByText("2 of 3 photos failed to upload.")).toBeTruthy();
  });

  it("quotes the reason when a single file fails", async () => {
    render(<EventPhotoManager eventId="7" />);
    await screen.findAllByAltText("Event photo");

    postUpload.mockResolvedValueOnce({ ok: false, error: "Only JPEG and PNG images are allowed." });

    pick(["a.gif"]);

    expect(await screen.findByText(/a.gif: Only JPEG and PNG images are allowed./)).toBeTruthy();
  });

  it("takes two clicks to remove a photo", async () => {
    render(<EventPhotoManager eventId="7" />);
    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(2));

    fireEvent.click(screen.getAllByRole("button")[0]);

    // Armed, not deleted: the first click cannot destroy a thumbnail the reader
    // is looking at.
    expect(await screen.findByText("Confirm")).toBeTruthy();
    expect(document.querySelectorAll("img")).toHaveLength(2);
  });

  it("removes the photo on the confirming click", async () => {
    render(<EventPhotoManager eventId="7" />);
    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(2));

    const remove = screen.getAllByRole("button")[0];
    fireEvent.click(remove);
    fireEvent.click(remove);

    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(1));
  });

  it("saves a caption on blur, not on every keystroke", async () => {
    render(<EventPhotoManager eventId="7" />);
    const inputs = await screen.findAllByLabelText("Photo caption");

    fireEvent.change(inputs[0], { target: { value: "Opening keynote" } });
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(1);

    fireEvent.blur(inputs[0]);

    await waitFor(() =>
      expect((globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[1][1].method).toBe(
        "PATCH",
      ),
    );
  });

  it("writes nothing when a caption is blurred unchanged", async () => {
    render(<EventPhotoManager eventId="7" />);
    const inputs = await screen.findAllByLabelText("Photo caption");

    fireEvent.blur(inputs[0]);

    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(1);
  });
});
