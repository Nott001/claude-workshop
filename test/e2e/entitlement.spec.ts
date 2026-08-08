import { ROLES } from "../../src/shared/lib/roles";
import { test, expect } from "@playwright/test";
import {
  serviceClient,
  createUser,
  createEvent,
  createCourse,
  uploadObject,
  issueTicket,
  signIn,
  cleanup,
  type SeededUser,
  type SeededEvent,
  type SeededCourse,
} from "./fixtures";

/**
 * Course material entitlement, against real storage and a real database.
 *
 * The mocked tests for this route stub `userHasCourseAccess` outright, so they
 * prove the route asks the question but never that the query answering it is
 * valid. That query joins TICKET to EVENT and EVENT_SPEAKER to SPEAKER_PROFILE;
 * a wrong relationship name would fail closed and lock everyone out, with every
 * unit test still green.
 *
 * A real object is uploaded because a missing file and a forbidden one both
 * return 404 by design — without it these tests would pass for the wrong reason.
 */

const db = serviceClient();
const users: SeededUser[] = [];
const events: SeededEvent[] = [];
const courses: SeededCourse[] = [];
const objects: Array<{ bucket: string; key: string }> = [];

let course: SeededCourse;
let event: SeededEvent;
let key: string;

test.beforeAll(async () => {
  event = await createEvent(db);
  events.push(event);

  course = await createCourse(db, event.eventId);
  courses.push(course);

  key = `courses/${course.courseId}/modules/1/lessons/1/e2e-slides.pdf`;
  await uploadObject(db, "course_assets", key, "%PDF-1.4 e2e");
  objects.push({ bucket: "course_assets", key });
});

test.afterAll(async () => {
  await cleanup(db, users, events, courses, objects);
});

test("an attendee holding a ticket can read the course material", async ({ page }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  users.push(attendee);
  await issueTicket(db, attendee.userId, event.eventId);

  await signIn(page, attendee);

  const res = await page.request.get(`/api/storage/course_assets/${key}`);

  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("pdf");
  // Entitlement is per user, so the response must not be shareable by a cache.
  expect(res.headers()["cache-control"]).toContain("private");
});

test("an attendee without a ticket is refused the same object", async ({ page }) => {
  const outsider = await createUser(db, ROLES.ATTENDEE);
  users.push(outsider);

  await signIn(page, outsider);

  const res = await page.request.get(`/api/storage/course_assets/${key}`);

  // 404 rather than 403: the caller must not learn the object exists.
  expect(res.status()).toBe(404);
});

test("a cancelled ticket does not grant access", async ({ page }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  users.push(attendee);
  await issueTicket(db, attendee.userId, event.eventId);
  await db.from("TICKET").update({ status: "cancelled" }).eq("user_id", attendee.userId).eq("event_id", event.eventId);

  await signIn(page, attendee);

  const res = await page.request.get(`/api/storage/course_assets/${key}`);

  expect(res.status()).toBe(404);
});

test("a facilitator reads course material without holding a ticket", async ({ page }) => {
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  users.push(facilitator);

  await signIn(page, facilitator);

  const res = await page.request.get(`/api/storage/course_assets/${key}`);

  expect(res.status()).toBe(200);
});

test("an unknown bucket is refused", async ({ page }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  users.push(attendee);
  await issueTicket(db, attendee.userId, event.eventId);

  await signIn(page, attendee);

  const res = await page.request.get(`/api/storage/secrets/${key}`);

  expect(res.status()).toBe(404);
});

test("a traversal-shaped key is refused", async ({ page }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  users.push(attendee);
  await issueTicket(db, attendee.userId, event.eventId);

  await signIn(page, attendee);

  const res = await page.request.get("/api/storage/course_assets/../../profile_images/x.png");

  expect(res.status()).toBe(404);
});
