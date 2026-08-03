import { describe, it, expect, vi, beforeEach } from "vitest";

const { download, from, requireAuth, userHasCourseAccess } = vi.hoisted(() => {
  const download = vi.fn();
  return {
    download,
    from: vi.fn(() => ({ download })),
    requireAuth: vi.fn(),
    userHasCourseAccess: vi.fn(),
  };
});

vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ storage: { from } }),
}));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/dao", () => ({ courseDao: { userHasCourseAccess } }));

import { GET } from "@/app/api/storage/[bucket]/[...path]/route";

const req = () => new Request("https://app.test/api/storage/x/y");
const params = (bucket: string, path: string[]) => ({ params: Promise.resolve({ bucket, path }) });

const attendee = { id: 5, role: "attendee", full_name: "Jane", email: "jane@example.com" };
const facilitator = { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com" };
const speaker = { id: 7, role: "speaker", full_name: "Sam", email: "sam@example.com" };

const lesson = ["courses", "12", "modules", "3", "lessons", "8", "slides.pdf"];

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(attendee);
  userHasCourseAccess.mockResolvedValue(true);
  download.mockResolvedValue({ data: new Blob(["bytes"], { type: "application/pdf" }), error: null });
});

describe("bucket allowlist", () => {
  it.each(["event_images", "profile_images", "course_assets", "course_videos"])("serves the known bucket %s", async (b) => {
    const res = await GET(req(), params(b, lesson));

    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith(b);
  });

  it.each(["secrets", "private", "auth", "", "COURSE_ASSETS"])("refuses the unknown bucket %j", async (b) => {
    const res = await GET(req(), params(b, ["x.pdf"]));

    expect(res.status).toBe(404);
    // Never reaches storage, so an unknown bucket cannot be probed for existence.
    expect(from).not.toHaveBeenCalled();
  });
});

describe("path safety", () => {
  it.each([
    [["..", "..", "private", "keys.json"]],
    [["courses", "..", "12"]],
    [["courses", "", "12"]],
    [["."]],
    [[]],
    [["a\\b"]],
  ])("refuses traversal-shaped path %j", async (segments) => {
    const res = await GET(req(), params("course_assets", segments));

    expect(res.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("passes a well-formed key through unchanged", async () => {
    await GET(req(), params("course_assets", lesson));

    expect(download).toHaveBeenCalledWith("courses/12/modules/3/lessons/8/slides.pdf");
  });
});

describe("authentication", () => {
  it("refuses an unauthenticated caller without touching storage", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(req(), params("course_assets", lesson));

    expect(res.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("does not require an entitlement check for non-course buckets", async () => {
    const res = await GET(req(), params("event_images", ["events", "1", "cover.png"]));

    expect(res.status).toBe(200);
    expect(userHasCourseAccess).not.toHaveBeenCalled();
  });
});

describe("course entitlement", () => {
  it("serves course material to a user who holds the entitlement", async () => {
    userHasCourseAccess.mockResolvedValue(true);

    const res = await GET(req(), params("course_videos", lesson));

    expect(res.status).toBe(200);
    expect(userHasCourseAccess).toHaveBeenCalledWith(expect.anything(), 5, 12);
  });

  it("refuses course material to a user without the entitlement", async () => {
    userHasCourseAccess.mockResolvedValue(false);

    const res = await GET(req(), params("course_videos", lesson));

    expect(res.status).toBe(404);
    // The regression this guards: paid course video readable by any signed-in user.
    expect(download).not.toHaveBeenCalled();
  });

  it("gives facilitators access without consulting entitlements", async () => {
    requireAuth.mockResolvedValue(facilitator);

    const res = await GET(req(), params("course_assets", lesson));

    expect(res.status).toBe(200);
    expect(userHasCourseAccess).not.toHaveBeenCalled();
  });

  // "Facilitator" here means facilitator *and up*. An equality test denied
  // admins and super_admins the material every facilitator already reads.
  it.each(["admin", "super_admin"])("gives %s the same access as a facilitator", async (role) => {
    requireAuth.mockResolvedValue({ ...facilitator, role });

    const res = await GET(req(), params("course_assets", lesson));

    expect(res.status).toBe(200);
    expect(userHasCourseAccess).not.toHaveBeenCalled();
  });

  it("checks entitlement for a speaker like any other non-facilitator", async () => {
    requireAuth.mockResolvedValue(speaker);
    userHasCourseAccess.mockResolvedValue(false);

    const res = await GET(req(), params("course_assets", lesson));

    expect(res.status).toBe(404);
    expect(userHasCourseAccess).toHaveBeenCalledWith(expect.anything(), 7, 12);
  });

  it.each([[["assets", "12", "x.pdf"]], [["courses", "abc", "x.pdf"]], [["courses", "-1", "x.pdf"]], [["courses"]]])(
    "refuses course material whose key carries no usable course id: %j",
    async (segments) => {
      const res = await GET(req(), params("course_assets", segments));

      expect(res.status).toBe(404);
      expect(download).not.toHaveBeenCalled();
    },
  );
});

describe("responses", () => {
  it("serves the object with its own content type", async () => {
    const res = await GET(req(), params("course_assets", lesson));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("falls back to octet-stream when the object has no type", async () => {
    download.mockResolvedValue({ data: new Blob(["bytes"]), error: null });

    const res = await GET(req(), params("course_assets", lesson));

    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("marks the response private so a shared cache cannot serve it onward", async () => {
    const res = await GET(req(), params("course_assets", lesson));

    expect(res.headers.get("cache-control")).toBe("private, max-age=0, must-revalidate");
  });

  it("returns the same 404 for a missing object as for a forbidden one", async () => {
    download.mockResolvedValue({ data: null, error: { message: "not found" } });
    const missing = await GET(req(), params("course_assets", lesson));

    userHasCourseAccess.mockResolvedValue(false);
    const forbidden = await GET(req(), params("course_assets", lesson));

    expect(missing.status).toBe(forbidden.status);
    await expect(missing.json()).resolves.toEqual(await forbidden.json());
  });

  it("does not leak the underlying storage error", async () => {
    download.mockResolvedValue({ data: null, error: { message: "bucket 'x' does not exist" } });

    const res = await GET(req(), params("course_assets", lesson));

    await expect(res.json()).resolves.toEqual({ error: "File not found" });
  });
});
