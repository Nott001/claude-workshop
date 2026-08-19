import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getCurrentUser,
  isPublished,
  eventFindById,
  isAssigned,
  photoListByEvent,
  photoFindById,
  photoCreate,
  photoRemove,
  photoUpdateCaption,
  nextSequenceOrder,
  uploadToStorage,
  deleteFromStorage,
  logAuditEvent,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isPublished: vi.fn(),
  eventFindById: vi.fn(),
  isAssigned: vi.fn(),
  photoListByEvent: vi.fn(),
  photoFindById: vi.fn(),
  photoCreate: vi.fn(),
  photoRemove: vi.fn(),
  photoUpdateCaption: vi.fn(),
  nextSequenceOrder: vi.fn(),
  uploadToStorage: vi.fn(),
  deleteFromStorage: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({ isPublished, findById: eventFindById }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ isAssigned }));
vi.mock("@/modules/events/db/event-photo.dao", () => ({
  listByEvent: photoListByEvent,
  findById: photoFindById,
  create: photoCreate,
  remove: photoRemove,
  updateCaption: photoUpdateCaption,
  nextSequenceOrder,
  listPreviewsByEvents: vi.fn(async () => new Map()),
  listStoragePathsByEvent: vi.fn(async () => []),
}));
vi.mock("@/shared/integrations/storage/service", () => ({
  uploadToStorage,
  deleteFromStorage,
  listStorageFolder: vi.fn(async () => []),
}));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { GET, POST } from "@/app/api/events/[id]/photos/route";
import { DELETE, PATCH } from "@/app/api/events/[id]/photos/[photoId]/route";

const user = (id: number, role: string) => ({
  id,
  role,
  full_name: "Fay",
  email: "fay@example.com",
  profile_image_url: null,
});
const admin = user(9, ROLES.ADMIN);
const facilitator = user(10, ROLES.FACILITATOR);
const attendee = user(5, ROLES.ATTENDEE);

const photo = { id: 4, event_id: 1, image_url: "/api/storage/event_images/events/1/photos/a.jpg", caption: null };

const list = (id = "1") => GET(new Request(`https://app.test/api/events/${id}/photos`), { params: Promise.resolve({ id }) });

function upload(id = "1", type = "image/png") {
  const form = new FormData();
  form.append("file", new File(["x"], "shot.png", { type }));
  return POST(new Request(`https://app.test/api/events/${id}/photos`, { method: "POST", body: form }), {
    params: Promise.resolve({ id }),
  });
}

const destroy = (id = "1", photoId = "4") =>
  DELETE(new Request(`https://app.test/api/events/${id}/photos/${photoId}`, { method: "DELETE" }), {
    params: Promise.resolve({ id, photoId }),
  });

const patch = (caption: unknown, id = "1", photoId = "4") =>
  PATCH(
    new Request(`https://app.test/api/events/${id}/photos/${photoId}`, {
      method: "PATCH",
      body: JSON.stringify({ caption }),
    }),
    { params: Promise.resolve({ id, photoId }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(null);
  isPublished.mockResolvedValue(true);
  eventFindById.mockResolvedValue({ id: 1, title: "Launch Day", status: "complete" });
  isAssigned.mockResolvedValue(true);
  photoListByEvent.mockResolvedValue([photo]);
  photoFindById.mockResolvedValue({ ...photo, storage_path: "events/1/photos/a.jpg" });
  photoCreate.mockResolvedValue(photo);
  photoRemove.mockResolvedValue(true);
  photoUpdateCaption.mockResolvedValue({ ...photo, caption: "Opening keynote" });
  nextSequenceOrder.mockResolvedValue(3);
  uploadToStorage.mockResolvedValue({ url: "/api/storage/event_images/events/1/photos/a.jpg", path: "events/1/photos/a.jpg" });
  deleteFromStorage.mockResolvedValue(undefined);
});

describe("GET /api/events/[id]/photos", () => {
  it("serves a published event's archive to a visitor with no session", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: [photo] });
  });

  it("hides a draft's photos behind the same 404 a missing event gets", async () => {
    isPublished.mockResolvedValue(false);

    const res = await list();

    // Not 403: a distinguishable refusal would make the photo count a way to
    // learn that an unannounced event exists.
    expect(res.status).toBe(404);
    expect(photoListByEvent).not.toHaveBeenCalled();
  });

  it("lets staff read a draft's archive while they are still curating it", async () => {
    isPublished.mockResolvedValue(false);
    getCurrentUser.mockResolvedValue(facilitator);

    const res = await list();

    expect(res.status).toBe(200);
  });

  it("does not let a signed-in attendee reach a draft's archive", async () => {
    isPublished.mockResolvedValue(false);
    getCurrentUser.mockResolvedValue(attendee);

    const res = await list();

    expect(res.status).toBe(404);
  });
});

describe("POST /api/events/[id]/photos", () => {
  it("refuses an anonymous upload", async () => {
    const res = await upload();

    expect(res.status).toBe(401);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("refuses an attendee", async () => {
    getCurrentUser.mockResolvedValue(attendee);

    const res = await upload();

    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("admits an assigned facilitator, who is the one who was in the room", async () => {
    getCurrentUser.mockResolvedValue(facilitator);

    const res = await upload();

    expect(res.status).toBe(201);
    expect(uploadToStorage).toHaveBeenCalled();
  });

  it("refuses a facilitator assigned to some other event", async () => {
    getCurrentUser.mockResolvedValue(facilitator);
    isAssigned.mockResolvedValue(false);

    const res = await upload();

    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("stores the object under the event's photo folder, never over its cover", async () => {
    getCurrentUser.mockResolvedValue(admin);

    await upload();

    const [bucket, path] = uploadToStorage.mock.calls[0];
    expect(bucket).toBe("event_images");
    expect(path).toMatch(/^events\/1\/photos\/[0-9a-f-]{36}\.png$/);
  });

  it("appends rather than overwriting the sequence", async () => {
    getCurrentUser.mockResolvedValue(admin);

    await upload();

    expect(photoCreate).toHaveBeenCalledWith({}, expect.objectContaining({ sequence_order: 3, uploaded_by: 9 }));
  });

  it("passes the same file-type gate the shared policy enforces", async () => {
    getCurrentUser.mockResolvedValue(admin);

    const res = await upload("1", "image/gif");

    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("gives the object back when its row cannot be written", async () => {
    getCurrentUser.mockResolvedValue(admin);
    photoCreate.mockResolvedValue(null);

    const res = await upload();

    // Without the row the object is unreachable, so leaving it in the bucket is
    // a cost with nothing pointing at it. The key rolled back is the one just
    // written, which is the one the upload generated.
    expect(res.status).toBe(500);
    const [bucket, paths] = deleteFromStorage.mock.calls[0];
    expect(bucket).toBe("event_images");
    expect(paths).toEqual([uploadToStorage.mock.calls[0][1]]);
  });

  it("answers with a `url` key, which is what postUpload reads", async () => {
    getCurrentUser.mockResolvedValue(admin);

    const body = await (await upload()).json();

    expect(body.url).toBe(photo.image_url);
    expect(body.id).toBe(4);
  });

  it("records the upload in the audit log", async () => {
    getCurrentUser.mockResolvedValue(admin);

    await upload();

    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 9, "event.photo_added", "event", 1, { photo_id: 4 });
  });
});

describe("DELETE /api/events/[id]/photos/[photoId]", () => {
  it("refuses an attendee", async () => {
    getCurrentUser.mockResolvedValue(attendee);

    const res = await destroy();

    expect(res.status).toBe(403);
    expect(photoRemove).not.toHaveBeenCalled();
  });

  it("refuses a photo that belongs to another event", async () => {
    getCurrentUser.mockResolvedValue(facilitator);
    photoFindById.mockResolvedValue({ ...photo, event_id: 2, storage_path: "events/2/photos/a.jpg" });

    const res = await destroy();

    // The two ids arrive independently in the URL. Without this check, a
    // facilitator assigned to event 1 could delete any photo of any event by
    // guessing its id.
    expect(res.status).toBe(404);
    expect(photoRemove).not.toHaveBeenCalled();
  });

  it("removes the row before the object", async () => {
    getCurrentUser.mockResolvedValue(admin);

    const res = await destroy();

    expect(res.status).toBe(200);
    // A row without its object renders a broken image on a public page; an
    // object without its row only costs storage.
    expect(photoRemove).toHaveBeenCalled();
    expect(deleteFromStorage).toHaveBeenCalledWith("event_images", ["events/1/photos/a.jpg"]);
  });

  it("leaves the object alone when the row will not delete", async () => {
    getCurrentUser.mockResolvedValue(admin);
    photoRemove.mockResolvedValue(false);

    const res = await destroy();

    expect(res.status).toBe(500);
    expect(deleteFromStorage).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/events/[id]/photos/[photoId]", () => {
  it("refuses an attendee", async () => {
    getCurrentUser.mockResolvedValue(attendee);

    const res = await patch("Opening keynote");

    expect(res.status).toBe(403);
    expect(photoUpdateCaption).not.toHaveBeenCalled();
  });

  it("saves a caption for a curator", async () => {
    getCurrentUser.mockResolvedValue(admin);

    const res = await patch("Opening keynote");

    expect(res.status).toBe(200);
    expect(photoUpdateCaption).toHaveBeenCalledWith({}, 4, "Opening keynote");
  });

  it("reads a blank caption as no caption, not as an empty line", async () => {
    getCurrentUser.mockResolvedValue(admin);

    await patch("   ");

    expect(photoUpdateCaption).toHaveBeenCalledWith({}, 4, null);
  });

  it("refuses a caption longer than the column holds", async () => {
    getCurrentUser.mockResolvedValue(admin);

    const res = await patch("x".repeat(201));

    expect(res.status).toBe(400);
    expect(photoUpdateCaption).not.toHaveBeenCalled();
  });

  it("answers a bad body with a message, not a Zod dump", async () => {
    getCurrentUser.mockResolvedValue(admin);

    const res = await patch(42);

    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe("string");
  });
});
