import { test, expect } from "@playwright/test";
import {
  serviceClient,
  createUser,
  createEvent,
  createCourse,
  issueTicket,
  signIn,
  cleanup,
  type SeededUser,
  type SeededEvent,
  type SeededCourse,
} from "./fixtures";

/**
 * Upload, then read back through the entitlement gate.
 *
 * This closes the loop the other specs leave open: `entitlement.spec.ts` seeds
 * an object with the service client, so it never proves the upload route puts
 * files where the storage route looks for them. Here the file goes in through
 * the application and comes back out through the application.
 */

const db = serviceClient();
const users: SeededUser[] = [];
const events: SeededEvent[] = [];
const courses: SeededCourse[] = [];
const objects: Array<{ bucket: string; key: string }> = [];

let event: SeededEvent;
let course: SeededCourse;
let moduleId: number;
let lessonId: number;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeAll(async () => {
  event = await createEvent(db);
  events.push(event);
  course = await createCourse(db, event.eventId);
  courses.push(course);

  const { data: mod, error: mErr } = await db
    .from("MODULE")
    .insert({ course_id: course.courseId, module_name: "e2e-module", sequence_order: 1 })
    .select("id")
    .single();
  if (mErr || !mod) throw new Error(`MODULE insert failed: ${mErr?.message}`);
  moduleId = mod.id;

  const { data: lesson, error: lErr } = await db
    .from("LESSON")
    .insert({ module_id: moduleId, description: "e2e-lesson", content_type: "pdf", sequence_order: 1 })
    .select("id")
    .single();
  if (lErr || !lesson) throw new Error(`LESSON insert failed: ${lErr?.message}`);
  lessonId = lesson.id;
});

test.afterAll(async () => {
  if (moduleId) await db.from("LESSON").delete().eq("module_id", moduleId);
  await cleanup(db, users, events, courses, objects);
});

test("a facilitator uploads a course asset and it becomes readable through the storage route", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);

  await signIn(page, facilitator);

  const upload = await page.request.post("/api/upload/course-asset", {
    multipart: {
      file: { name: "e2e-notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") },
      lesson_id: String(lessonId),
      course_id: String(course.courseId),
      module_id: String(moduleId),
    },
  });

  expect(upload.status()).toBe(200);
  const { url, path } = await upload.json();
  objects.push({ bucket: "course_assets", key: path });

  // The upload route reports the URL the storage route serves. If the two ever
  // disagree on path shape, this is where it shows.
  expect(url).toBe(`/api/storage/course_assets/${path}`);

  const read = await page.request.get(url);
  expect(read.status()).toBe(200);
});

test("an attendee holding a ticket can read an uploaded asset, and one without cannot", async ({ page, browser }) => {
  const facilitator = await createUser(db, "facilitator");
  const holder = await createUser(db, "attendee");
  const outsider = await createUser(db, "attendee");
  users.push(facilitator, holder, outsider);
  await issueTicket(db, holder.userId, event.eventId);

  await signIn(page, facilitator);
  const upload = await page.request.post("/api/upload/course-asset", {
    multipart: {
      file: { name: "e2e-gated.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 gated") },
      lesson_id: String(lessonId),
      course_id: String(course.courseId),
      module_id: String(moduleId),
    },
  });
  expect(upload.status()).toBe(200);
  const { url, path } = await upload.json();
  objects.push({ bucket: "course_assets", key: path });

  const holderCtx = await browser.newContext();
  const holderPage = await holderCtx.newPage();
  await signIn(holderPage, holder);
  expect((await holderPage.request.get(url)).status()).toBe(200);
  await holderCtx.close();

  const outsiderCtx = await browser.newContext();
  const outsiderPage = await outsiderCtx.newPage();
  await signIn(outsiderPage, outsider);
  expect((await outsiderPage.request.get(url)).status()).toBe(404);
  await outsiderCtx.close();
});

test("an attendee cannot upload course material", async ({ page }) => {
  const attendee = await createUser(db, "attendee");
  users.push(attendee);

  await signIn(page, attendee);

  const res = await page.request.post("/api/upload/course-asset", {
    multipart: {
      file: { name: "e2e-nope.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      lesson_id: String(lessonId),
      course_id: String(course.courseId),
      module_id: String(moduleId),
    },
  });

  expect(res.status()).toBe(401);
});

test("a file type the bucket does not accept is refused", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);

  await signIn(page, facilitator);

  const res = await page.request.post("/api/upload/course-video", {
    multipart: {
      file: { name: "e2e-not-a-video.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      lesson_id: String(lessonId),
      course_id: String(course.courseId),
      module_id: String(moduleId),
    },
  });

  expect(res.status()).toBe(400);
});

test("a missing field is refused before anything is stored", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);

  await signIn(page, facilitator);

  const res = await page.request.post("/api/upload/course-asset", {
    multipart: {
      file: { name: "e2e-orphan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      lesson_id: String(lessonId),
    },
  });

  expect(res.status()).toBe(400);
});

test("a facilitator uploads an event cover and it is recorded on the event", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);

  await signIn(page, facilitator);

  const res = await page.request.post("/api/upload/event-image", {
    multipart: {
      file: { name: "e2e-cover.png", mimeType: "image/png", buffer: PNG },
      event_id: String(event.eventId),
    },
  });

  expect(res.status()).toBe(200);
  const { path } = await res.json();
  objects.push({ bucket: "event_images", key: path });

  const { data } = await db.from("EVENT").select("cover_image_url").eq("id", event.eventId).single();
  expect(data?.cover_image_url).toContain("/api/storage/event_images/");
});
