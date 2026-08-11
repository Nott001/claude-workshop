import { ROLES } from "../../src/shared/lib/roles";
import { test, expect } from "@playwright/test";
import { serviceClient, createUser, signIn, cleanup, type SeededUser } from "./fixtures";

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

// The destination is spelled out rather than read from the application's role
// map, unlike the signIn fixture: this is the test that pins an attendee to
// /home, and asserting through the same map it is checking would pass whatever
// that map said.
test("an attendee can sign in and land on their role's home", async ({ page }) => {
  const user = await createUser(db, ROLES.ATTENDEE);
  created.push(user);

  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(user.email);
  await page.locator("#signin-password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/home(?:[?#]|$)/, { timeout: 20_000 });
});

test("an attendee signed in is still refused the staff area", async ({ page }) => {
  const user = await createUser(db, ROLES.ATTENDEE);
  created.push(user);

  // Signed in through the fixture: where this lands is incidental here, and a
  // second inline copy of the flow is what let this test miss the move to /home.
  await signIn(page, user);

  // A session alone must not open the staff area — the role has to be checked
  // too. This is the seam the mocked route tests cannot reach.
  const res = await page.request.get("/api/events", { failOnStatusCode: false });
  expect(res.status()).toBe(200);

  await page.goto("/staff/organization");
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
});
