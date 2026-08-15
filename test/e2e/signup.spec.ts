import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { serviceClient, E2E_PREFIX } from "./fixtures";

/**
 * The sign-up form.
 *
 * Only validation is exercised. A successful sign-up sends a confirmation
 * email, and this Supabase project rate-limits those per hour — running the
 * happy path on every pull request exhausts the quota and then fails for
 * reasons unrelated to the change. A test that goes red on unrelated work is
 * worse than an absent one, so those cases are skipped rather than shipped.
 *
 * To enable them, either turn off email confirmation for the project or
 * configure custom SMTP, then delete the skip markers. See SPEC-09-TEST-STRATEGY §9.
 */

const db = serviceClient();
const createdEmails: string[] = [];

test.afterAll(async () => {
  if (!createdEmails.length) return;

  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const u of data?.users ?? []) {
    if (u.email && createdEmails.includes(u.email)) {
      const { error } = await db.auth.admin.deleteUser(u.id);
      if (error) console.warn(`cleanup signup user: ${error.message}`);
    }
  }
  await db.from("USER").delete().in("email", createdEmails);
});

async function fillSignUp(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-up");
  await page.locator("#signup-name").fill("E2E Signup");
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-password").fill(password);
  await page.locator("#signup-confirm-password").fill(password);
  await page.locator("#signup-terms").check();
  await page.getByRole("button", { name: /^sign up$/i }).click();
}

test("the form is reachable without a session and renders its fields", async ({ page }) => {
  await page.goto("/sign-up");

  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
  await expect(page.locator("#signup-name")).toBeVisible();
  await expect(page.locator("#signup-email")).toBeVisible();
  await expect(page.locator("#signup-password")).toBeVisible();
  await expect(page.locator("#signup-confirm-password")).toBeVisible();
  await expect(page.locator("#signup-terms")).toBeVisible();
});

test("sign-up cannot proceed without accepting the terms", async ({ page }) => {
  await page.goto("/sign-up");
  await page.locator("#signup-name").fill("E2E Signup");
  await page.locator("#signup-email").fill(`${E2E_PREFIX}terms@example.test`);
  await page.locator("#signup-password").fill("the quiet kettle sings");
  await page.locator("#signup-confirm-password").fill("the quiet kettle sings");
  await page.getByRole("button", { name: /^sign up$/i }).click();

  await expect(page.getByText("Please accept the Terms of Service and Privacy Policy to continue.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up/);
});

test("a mistyped confirmation is caught before any account is created", async ({ page }) => {
  const email = `${E2E_PREFIX}signup-${randomUUID().slice(0, 8)}@example.test`;

  await page.goto("/sign-up");
  await page.locator("#signup-name").fill("E2E Signup");
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-password").fill("the quiet kettle sings");
  await page.locator("#signup-confirm-password").fill("the loud kettle sings");
  await page.locator("#signup-terms").check();
  await page.getByRole("button", { name: /^sign up$/i }).click();

  // Refused in the browser, so this case sends no mail and is safe to repeat.
  await expect(page.getByText("Those passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up/);

  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  expect((data?.users ?? []).some((u) => u.email === email)).toBe(false);
});

test("a password below the minimum is rejected without creating an account", async ({ page }) => {
  const email = `${E2E_PREFIX}signup-${randomUUID().slice(0, 8)}@example.test`;

  await fillSignUp(page, email, "x");

  // Rejected before any email is sent, so this case is safe to run repeatedly.
  await expect(page.getByText(/password/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/sign-up/);

  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  expect((data?.users ?? []).some((u) => u.email === email)).toBe(false);
});

test("the form requires every field before it will submit", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: /^sign up$/i }).click();

  // Native validation keeps the user on the page rather than posting a blank form.
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
});

test.skip("signing up creates an account and asks for verification", async ({ page }) => {
  const email = `${E2E_PREFIX}signup-${randomUUID().slice(0, 8)}@example.test`;
  createdEmails.push(email);

  await fillSignUp(page, email, `E2e!${randomUUID()}`);

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 20_000 });

  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  const created = (data?.users ?? []).find((u) => u.email === email);
  expect(created, "the form should have created an auth user").toBeTruthy();
  expect(created?.user_metadata?.full_name).toBe("E2E Signup");
});

test.skip("an unverified account cannot sign in", async ({ page }) => {
  const email = `${E2E_PREFIX}signup-${randomUUID().slice(0, 8)}@example.test`;
  const password = `E2e!${randomUUID()}`;
  createdEmails.push(email);

  await fillSignUp(page, email, password);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 20_000 });

  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
});
