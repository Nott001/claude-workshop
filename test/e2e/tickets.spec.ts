import { test, expect } from "@playwright/test";
import { serviceClient, createUser, createEvent, signIn, cleanup, type SeededUser, type SeededEvent } from "./fixtures";

/**
 * The purchase path, against a real database.
 *
 * The mocked route tests assert that the handler calls the right DAO. These
 * assert the query it builds actually works against Postgres, that the
 * simulated gateway really writes a payment and a ticket, and that the ticket
 * is retrievable afterwards.
 */

const db = serviceClient();
const users: SeededUser[] = [];
const events: SeededEvent[] = [];

test.afterAll(async () => {
  await cleanup(db, users, events);
});

test.describe.configure({ mode: "serial" });

test("an attendee can buy a ticket and see it afterwards", async ({ page }) => {
  const attendee = await createUser(db, "attendee");
  const event = await createEvent(db);
  users.push(attendee);
  events.push(event);

  await signIn(page, attendee);

  const purchase = await page.request.post("/api/payments", {
    data: { event_id: event.eventId },
  });
  expect(purchase.status()).toBe(200);

  const { payment_id } = await purchase.json();
  expect(payment_id).toBeGreaterThan(0);

  // The gateway is simulated, but the ticket it issues is a real row.
  const tickets = await page.request.get("/api/tickets");
  expect(tickets.status()).toBe(200);

  const body = await tickets.json();
  const mine = body.filter((t: { event_id: number }) => t.event_id === event.eventId);
  expect(mine).toHaveLength(1);
  expect(mine[0].status).toBe("issued");
});

test("buying twice for the same event is refused", async ({ page }) => {
  const attendee = await createUser(db, "attendee");
  const event = await createEvent(db);
  users.push(attendee);
  events.push(event);

  await signIn(page, attendee);

  const first = await page.request.post("/api/payments", { data: { event_id: event.eventId } });
  expect(first.status()).toBe(200);

  const second = await page.request.post("/api/payments", { data: { event_id: event.eventId } });
  expect(second.status()).toBe(409);

  // One ticket, not two. The mocked test asserts the handler returns 409; this
  // asserts the database did not gain a second row.
  const { count } = await db
    .from("TICKET")
    .select("*", { count: "exact", head: true })
    .eq("user_id", attendee.userId)
    .eq("event_id", event.eventId);
  expect(count).toBe(1);
});

test("a draft event cannot be bought", async ({ page }) => {
  const attendee = await createUser(db, "attendee");
  const event = await createEvent(db, { status: "draft" });
  users.push(attendee);
  events.push(event);

  await signIn(page, attendee);

  const res = await page.request.post("/api/payments", { data: { event_id: event.eventId } });

  expect(res.status()).toBe(404);
});

test("a facilitator checks in a ticket, and a replay is reported as duplicate", async ({ page, browser }) => {
  const attendee = await createUser(db, "attendee");
  const facilitator = await createUser(db, "facilitator");
  const event = await createEvent(db);
  users.push(attendee, facilitator);
  events.push(event);

  // Attendee buys, in their own browser context.
  const attendeeCtx = await browser.newContext();
  const attendeePage = await attendeeCtx.newPage();
  await signIn(attendeePage, attendee);
  const purchase = await attendeePage.request.post("/api/payments", { data: { event_id: event.eventId } });
  expect(purchase.status()).toBe(200);
  await attendeeCtx.close();

  // The QR token is never exposed through the API, so it is read directly.
  const { data: ticket } = await db
    .from("TICKET")
    .select("qr_token")
    .eq("user_id", attendee.userId)
    .eq("event_id", event.eventId)
    .single();
  expect(ticket?.qr_token).toBeTruthy();

  await signIn(page, facilitator);

  const first = await page.request.post("/api/checkin", { data: { qr_token: ticket!.qr_token } });
  expect(first.status()).toBe(200);
  expect((await first.json()).status).toBe("success");

  const replay = await page.request.post("/api/checkin", { data: { qr_token: ticket!.qr_token } });
  expect((await replay.json()).status).toBe("duplicate");

  // The ticket moved once and stayed there.
  const { data: after } = await db
    .from("TICKET")
    .select("status, checked_in_by")
    .eq("user_id", attendee.userId)
    .eq("event_id", event.eventId)
    .single();
  expect(after?.status).toBe("checked_in");
  expect(after?.checked_in_by).toBe(facilitator.userId);
});

test("an attendee cannot check in a ticket", async ({ page }) => {
  const attendee = await createUser(db, "attendee");
  const event = await createEvent(db);
  users.push(attendee);
  events.push(event);

  await signIn(page, attendee);
  await page.request.post("/api/payments", { data: { event_id: event.eventId } });

  const { data: ticket } = await db
    .from("TICKET")
    .select("qr_token")
    .eq("user_id", attendee.userId)
    .eq("event_id", event.eventId)
    .single();

  const res = await page.request.post("/api/checkin", { data: { qr_token: ticket!.qr_token } });

  expect(res.status()).toBe(401);

  const { data: after } = await db
    .from("TICKET")
    .select("status")
    .eq("user_id", attendee.userId)
    .eq("event_id", event.eventId)
    .single();
  expect(after?.status).toBe("issued");
});

test("a forged qr token is refused", async ({ page }) => {
  const facilitator = await createUser(db, "facilitator");
  users.push(facilitator);

  await signIn(page, facilitator);

  const res = await page.request.post("/api/checkin", { data: { qr_token: "e2e-forged-token-does-not-exist" } });

  expect(res.status()).toBe(404);
});
