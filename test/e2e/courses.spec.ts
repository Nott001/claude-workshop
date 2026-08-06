import { test, expect } from "@playwright/test";
import {
  serviceClient,
  createUser,
  createEvent,
  createCourse,
  assignFacilitator,
  assignSpeaker,
  signIn,
  cleanup,
  type SeededUser,
  type SeededEvent,
  type SeededCourse,
} from "./fixtures";

/**
 * Course authoring: modules and lessons.
 *
 * The course itself is seeded rather than created through the API, so authoring
 * below the course level is tested in isolation. A course belongs to exactly one
 * event (COURSE.event_id — the contract from SPEC-01), and every facilitator who
 * authors is assigned to that event first, because the SPEC-02 policy 403s
 * anyone who is not.
 */

const db = serviceClient();
const users: SeededUser[] = [];
const events: SeededEvent[] = [];
const courses: SeededCourse[] = [];
const moduleIds: number[] = [];

let event: SeededEvent;
let course: SeededCourse;

test.beforeAll(async () => {
  event = await createEvent(db);
  events.push(event);
  course = await createCourse(db, event.eventId);
  courses.push(course);
});

test.afterAll(async () => {
  if (moduleIds.length) await db.from("LESSON").delete().in("module_id", moduleIds);
  await cleanup(db, users, events, courses);
});

test("a facilitator adds a module to a course", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);
  await assignFacilitator(db, facilitator.userId, event.eventId);

  await signIn(page, facilitator);

  const res = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-module-one", sequence_order: 1 },
  });

  expect(res.status()).toBe(201);
  const mod = await res.json();
  moduleIds.push(mod.id);

  expect(mod.module_name).toBe("e2e-module-one");
  expect(mod.course_id).toBe(course.courseId);
});

test("a facilitator adds a lesson to a module", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);
  await assignFacilitator(db, facilitator.userId, event.eventId);

  await signIn(page, facilitator);

  const modRes = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-module-two", sequence_order: 2 },
  });
  const mod = await modRes.json();
  moduleIds.push(mod.id);

  const res = await page.request.post(`/api/modules/${mod.id}/lessons`, {
    data: { description: "e2e-lesson-one", content_type: "link", sequence_order: 1 },
  });

  expect(res.status()).toBe(201);
  const lesson = await res.json();
  expect(lesson.description).toBe("e2e-lesson-one");
  expect(lesson.module_id).toBe(mod.id);
});

test("the curriculum reads back with its modules and lessons", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);
  await assignFacilitator(db, facilitator.userId, event.eventId);

  await signIn(page, facilitator);

  const modRes = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-module-three", sequence_order: 3 },
  });
  const mod = await modRes.json();
  moduleIds.push(mod.id);

  await page.request.post(`/api/modules/${mod.id}/lessons`, {
    data: { description: "e2e-lesson-readback", content_type: "link", sequence_order: 1 },
  });

  // The course detail endpoint nests MODULE -> LESSONS, which is the join that
  // would break silently if a relationship name were wrong.
  const detail = await page.request.get(`/api/courses/${course.courseId}`);
  expect(detail.status()).toBe(200);

  const body = await detail.json();
  const found = (body.MODULE ?? []).find((m: { id: number }) => m.id === mod.id);
  expect(found, "the module just created should be in the course detail").toBeTruthy();
  expect((found.LESSONS ?? []).some((l: { description: string }) => l.description === "e2e-lesson-readback")).toBe(true);
});

test("an invalid module is refused without writing", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);
  await assignFacilitator(db, facilitator.userId, event.eventId);

  await signIn(page, facilitator);

  const blank = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "", sequence_order: 1 },
  });
  expect(blank.status()).toBe(400);

  const badOrder = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-bad", sequence_order: 0 },
  });
  expect(badOrder.status()).toBe(400);
});

test("an unassigned facilitator cannot author course content", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);

  await signIn(page, facilitator);

  const { count: before } = await db
    .from("MODULE")
    .select("*", { count: "exact", head: true })
    .eq("course_id", course.courseId);

  const mod = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-should-not-exist", sequence_order: 9 },
  });
  // 403, not 401: the caller signed in above, so this is a permission refusal.
  expect(mod.status()).toBe(403);

  const { count: after } = await db.from("MODULE").select("*", { count: "exact", head: true }).eq("course_id", course.courseId);
  expect(after).toBe(before);
});

test("an attendee cannot author course content", async ({ page }) => {
  const attendee = await createUser(db, "attendee");
  users.push(attendee);

  await signIn(page, attendee);

  const mod = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-should-not-exist", sequence_order: 9 },
  });
  // 403, not 401: the caller signed in above, so this is a permission refusal
  // rather than a missing session. See guardFailure.
  expect(mod.status()).toBe(403);

  const list = await page.request.get("/api/courses");
  expect(list.status()).toBe(403);
});

test("a facilitator deleting a module removes its lessons", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);
  await assignFacilitator(db, facilitator.userId, event.eventId);

  await signIn(page, facilitator);

  const modRes = await page.request.post(`/api/courses/${course.courseId}/modules`, {
    data: { module_name: "e2e-module-doomed", sequence_order: 8 },
  });
  const mod = await modRes.json();

  await page.request.post(`/api/modules/${mod.id}/lessons`, {
    data: { description: "e2e-lesson-doomed", content_type: "link", sequence_order: 1 },
  });

  const del = await page.request.delete(`/api/modules/${mod.id}`);
  expect(del.status()).toBe(200);

  const { count } = await db.from("LESSON").select("*", { count: "exact", head: true }).eq("module_id", mod.id);
  expect(count).toBe(0);
});

/**
 * Creating a course through the API works now that the route forwards event_id
 * and the SPEC-02 policy gates on assignment. The course is pushed to `courses`
 * so teardown removes it like every other seeded course.
 */
test("an assigned facilitator can create a course through the API", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);
  await assignFacilitator(db, facilitator.userId, event.eventId);

  await signIn(page, facilitator);

  const res = await page.request.post("/api/courses", {
    // course_description: null is what the UI sends when the field is empty.
    data: { course_name: "e2e-created-course", course_description: null, event_id: event.eventId },
  });

  expect(res.status()).toBe(201);
  const created = await res.json();
  courses.push({ courseId: created.id, name: created.course_name });
});

/**
 * The same create, but as a speaker. The speaker gate resolves the profile by
 * user id and checks the EVENT_SPEAKER row directly — the embedded-filter
 * version of that query made PostgREST answer PGRST108, which returned false
 * for every speaker and 403'd the create. This exercises that exact path.
 */
test("an assigned speaker can create a course through the API", async ({ page }) => {
  const speaker = await createUser(db, "speaker");
  users.push(speaker);
  await assignSpeaker(db, speaker.userId, event.eventId);

  await signIn(page, speaker);

  const res = await page.request.post("/api/courses", {
    data: { course_name: "e2e-speaker-course", course_description: null, event_id: event.eventId },
  });

  expect(res.status()).toBe(201);
  const created = await res.json();
  courses.push({ courseId: created.id, name: created.course_name });
});
