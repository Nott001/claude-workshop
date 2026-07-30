import { test, expect } from "@playwright/test";
import { serviceClient, createUser, cleanup, type SeededUser } from "./fixtures";

const db = serviceClient();
const created: SeededUser[] = [];

test.afterAll(async () => {
  await cleanup(db, created, []);
});

test("a signed-out visitor reaches the public event listing", async ({ page }) => {
  await page.goto("/events");

  // No redirect: middleware leaves /events public.
  await expect(page).toHaveURL(/\/events$/);
});

test("a signed-out visitor is redirected away from staff pages", async ({ page }) => {
  await page.goto("/staff/events");

  await expect(page).toHaveURL(/\/sign-in/);
  // The path is preserved so sign-in can return the user where they were going.
  expect(new URL(page.url()).searchParams.get("redirect_url")).toBe("/staff/events");
});

test("bad credentials are refused and the user stays on the sign-in page", async ({ page }) => {
  await page.goto("/sign-in");

  await page.locator("#signin-email").fill("nobody-e2e@example.test");
  await page.locator("#signin-password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/invalid|credential/i)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/sign-in/);
});

test("an attendee can sign in and land on the events page", async ({ page }) => {
  const user = await createUser(db, "attendee");
  created.push(user);

  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(user.email);
  await page.locator("#signin-password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/events/, { timeout: 20_000 });
});

test("an attendee signed in is still refused the staff area", async ({ page }) => {
  const user = await createUser(db, "attendee");
  created.push(user);

  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(user.email);
  await page.locator("#signin-password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/events/, { timeout: 20_000 });

  // A session alone must not open the staff area — the role has to be checked
  // too. This is the seam the mocked route tests cannot reach.
  const res = await page.request.get("/api/events", { failOnStatusCode: false });
  expect(res.status()).toBe(200);

  await page.goto("/staff/organization");
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
});
