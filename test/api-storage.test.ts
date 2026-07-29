import { describe, it, expect, vi, beforeEach } from "vitest";

const { download, from } = vi.hoisted(() => {
  const download = vi.fn();
  return { download, from: vi.fn(() => ({ download })) };
});

vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ storage: { from } }),
}));

import { GET } from "@/app/api/storage/[bucket]/[...path]/route";

const req = () => new Request("https://app.test/api/storage/x/y");
const params = (bucket: string, path: string[]) => ({ params: Promise.resolve({ bucket, path }) });

beforeEach(() => {
  vi.clearAllMocks();
  download.mockResolvedValue({ data: new Blob(["pdf bytes"], { type: "application/pdf" }), error: null });
});

describe("object lookup", () => {
  it("reassembles the path segments into an object key", async () => {
    await GET(req(), params("course-assets", ["courses", "12", "intro.pdf"]));

    expect(from).toHaveBeenCalledWith("course-assets");
    expect(download).toHaveBeenCalledWith("courses/12/intro.pdf");
  });

  it("serves the object with its own content type", async () => {
    const res = await GET(req(), params("course-assets", ["intro.pdf"]));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("falls back to octet-stream when the object has no type", async () => {
    download.mockResolvedValue({ data: new Blob(["bytes"]), error: null });

    const res = await GET(req(), params("course-assets", ["unknown.bin"]));

    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("asks the browser to revalidate rather than cache the object", async () => {
    const res = await GET(req(), params("course-assets", ["intro.pdf"]));
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  });
});

describe("missing objects", () => {
  it("returns 404 when storage reports an error", async () => {
    download.mockResolvedValue({ data: null, error: { message: "not found" } });

    const res = await GET(req(), params("course-assets", ["nope.pdf"]));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "File not found" });
  });

  it("returns 404 when storage returns no data and no error", async () => {
    download.mockResolvedValue({ data: null, error: null });

    const res = await GET(req(), params("course-assets", ["nope.pdf"]));

    expect(res.status).toBe(404);
  });

  it("does not leak the underlying storage error to the caller", async () => {
    download.mockResolvedValue({ data: null, error: { message: "bucket 'private' does not exist" } });

    const res = await GET(req(), params("private", ["x"]));

    await expect(res.json()).resolves.toEqual({ error: "File not found" });
  });
});

// The route performs no authorization of its own. It reads with the service
// client, which bypasses row level security, and takes both the bucket and the
// object key straight from the URL. Any signed-in user therefore reads any
// object in any bucket; the middleware only checks that a session exists.
//
// These tests pin the behaviour so that a fix is a visible, deliberate change
// to this file rather than a silent one. They are not an endorsement.
// See SPEC-07 §3 (P0) — this is the top storage finding.
describe("KNOWN GAP: no per-object authorization", () => {
  it("serves any bucket named in the url without an ownership check", async () => {
    const res = await GET(req(), params("any-bucket-at-all", ["someone-elses-file.pdf"]));

    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith("any-bucket-at-all");
  });

  it("passes traversal-shaped segments through unsanitised", async () => {
    await GET(req(), params("course-assets", ["..", "..", "private", "keys.json"]));

    expect(download).toHaveBeenCalledWith("../../private/keys.json");
  });
});
