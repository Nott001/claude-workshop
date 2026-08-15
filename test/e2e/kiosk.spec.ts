import { ROLES } from "../../src/shared/lib/roles";
import { test, expect } from "@playwright/test";
import {
  serviceClient,
  createUser,
  createEvent,
  assignFacilitator,
  signIn,
  cleanup,
  type SeededUser,
  type SeededEvent,
} from "./fixtures";

const db = serviceClient();
const users: SeededUser[] = [];
const events: SeededEvent[] = [];

test.afterAll(async () => {
  await cleanup(db, users, events);
});

/** A facilitator on the event's team — the only role the kiosk opens for. */
async function seedKiosk() {
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  const event = await createEvent(db);
  await assignFacilitator(db, facilitator.userId, event.eventId);
  users.push(facilitator);
  events.push(event);
  return { facilitator, event };
}

test("the kiosk renders with no app chrome around it", async ({ page }) => {
  const { facilitator, event } = await seedKiosk();

  await signIn(page, facilitator);
  await page.goto(`/staff/events/${event.eventId}/kiosk`);

  await expect(page.getByText("StartupLab — Kiosk mode")).toBeVisible();

  // The chrome AppShell would otherwise wrap this in: the staff header, the
  // icon rail, its nav landmark and the site footer. One bar, and it is ours.
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
});

test("the kiosk fits the viewport of the tablet it runs on", async ({ page }) => {
  const { facilitator, event } = await seedKiosk();

  await signIn(page, facilitator);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/staff/events/${event.eventId}/kiosk`);
  await expect(page.getByText("StartupLab — Kiosk mode")).toBeVisible();

  // h-dvh, so the document itself never scrolls; the panes scroll inside it.
  // A page taller than its viewport is the old layout, where the kiosk sat in
  // the app's scrolling main column with a footer under the scanner.
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(overflow).toBeLessThanOrEqual(1);

  // The bar is pinned at the top of that viewport rather than pushed down by
  // a navbar above it.
  const bar = page.getByText("StartupLab — Kiosk mode");
  expect((await bar.boundingBox())!.y).toBeLessThan(64);
});

test("leaving the kiosk lands on the event, where the chrome returns", async ({ page }) => {
  const { facilitator, event } = await seedKiosk();

  await signIn(page, facilitator);
  await page.goto(`/staff/events/${event.eventId}/kiosk`);

  await page.getByRole("button", { name: /EXIT KIOSK/ }).click();

  await page.waitForURL(new RegExp(`/staff/events/${event.eventId}(?:[?#]|$)`));
  // The opt-out is scoped to the kiosk route, not to everything beneath the
  // event, so the staff header is back on the page the kiosk was opened from.
  await expect(page.locator("header")).toHaveCount(1);
});

test("the kiosk opens for an event whose end time has passed", async ({ page }) => {
  const facilitator = await createUser(db, ROLES.FACILITATOR);
  // Yesterday: still checking people in past the published end is exactly the
  // case the old ?filter=upcoming lookup dropped.
  const ended = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const event = await createEvent(db, { event_date: ended, start_time: "09:00", end_time: "17:00" });
  await assignFacilitator(db, facilitator.userId, event.eventId);
  users.push(facilitator);
  events.push(event);

  await signIn(page, facilitator);
  await page.goto(`/staff/events/${event.eventId}/kiosk`);

  await expect(page.getByText(event.title)).toBeVisible();
  await expect(page.getByText("Event not found or unavailable.")).toHaveCount(0);
});
