import { ROLES } from "../../src/shared/lib/roles";
import { test, expect } from "@playwright/test";
import { serviceClient, createUser, createEvent, signIn, cleanup, type SeededUser, type SeededEvent } from "./fixtures";

const db = serviceClient();
const users: SeededUser[] = [];
const events: SeededEvent[] = [];

test.afterAll(async () => {
  await cleanup(db, users, events);
});

test("a draft event is hidden from an attendee and visible to a facilitator", async ({ page, browser }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  const event = await createEvent(db, { status: "draft" });
  users.push(attendee, facilitator);
  events.push(event);

  await signIn(page, attendee);
  const asAttendee = await page.request.get(`/api/events/${event.eventId}/register`);
  // 404, not 403 — an attendee should not learn the draft exists.
  expect(asAttendee.status()).toBe(404);

  const ctx = await browser.newContext();
  const staffPage = await ctx.newPage();
  await signIn(staffPage, facilitator);
  const asFacilitator = await staffPage.request.get(`/api/events/${event.eventId}/register`);
  expect(asFacilitator.status()).toBe(200);
  await ctx.close();
});

test("publishing moves a draft to active", async ({ page }) => {
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  const event = await createEvent(db, { status: "draft" });
  users.push(facilitator);
  events.push(event);

  await signIn(page, facilitator);

  const res = await page.request.post(`/api/events/${event.eventId}/publish`);
  expect(res.status()).toBe(200);

  const { data } = await db.from("EVENT").select("status").eq("id", event.eventId).single();
  expect(data?.status).toBe("active");
});

test("an already published event cannot be published again", async ({ page }) => {
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  const event = await createEvent(db);
  users.push(facilitator);
  events.push(event);

  await signIn(page, facilitator);

  const res = await page.request.post(`/api/events/${event.eventId}/publish`);

  // Guards against re-firing whatever publishing triggers downstream.
  expect(res.status()).toBe(400);
});

test("an attendee cannot publish an event", async ({ page }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  const event = await createEvent(db, { status: "draft" });
  users.push(attendee);
  events.push(event);

  await signIn(page, attendee);

  const res = await page.request.post(`/api/events/${event.eventId}/publish`);
  // 403, not 401: the attendee is authenticated, just not permitted.
  expect(res.status()).toBe(403);

  const { data } = await db.from("EVENT").select("status").eq("id", event.eventId).single();
  expect(data?.status).toBe("draft");
});

test("an attendee cannot create an event", async ({ page }) => {
  const attendee = await createUser(db, ROLES.ATTENDEE);
  users.push(attendee);

  await signIn(page, attendee);

  const res = await page.request.post("/api/events", {
    data: {
      title: "e2e-should-not-exist",
      event_date: "2099-01-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "nowhere",
    },
  });

  // 403, not 401: the attendee is authenticated, just not permitted.
  expect(res.status()).toBe(403);
});

/**
 * Creating an event through the API is broken against the live database.
 *
 * `POST /api/events` always writes `course_id` into EVENT, but that column does
 * not exist — the live schema links these the other way, as COURSE.event_id.
 * Every creation therefore fails, which is why the database holds no events.
 *
 * Marked fixme rather than deleted so the gap stays visible. Remove the marker
 * once the schema drift in SPEC-09-TEST-STRATEGY §9 is resolved; this test then holds the fix
 * in place.
 */
test.fixme("a facilitator can create an event through the API", async ({ page }) => {
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  users.push(facilitator);

  await signIn(page, facilitator);

  const res = await page.request.post("/api/events", {
    data: {
      title: "e2e-created-event",
      event_date: "2099-01-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "E2E Hall",
    },
  });

  expect(res.status()).toBe(200);

  const created = await res.json();
  events.push({ eventId: created.id, title: created.title });
  expect(created.status).toBe("draft");
});
