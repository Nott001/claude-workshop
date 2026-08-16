import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ROLES } from "../../src/shared/lib/roles";
import {
  serviceClient,
  createUser,
  createEvent,
  createCourse,
  signIn,
  uploadObject,
  cleanup,
  type SeededUser,
  type SeededEvent,
  type SeededCourse,
} from "./fixtures";

/**
 * End-to-end account deletion.
 *
 * Seeds an account that holds every kind of record the teardown claims to
 * remove — an open support case, chat messages to and from the user, a ticket,
 * a Q&A post, a survey response, an email log, a password-reset attempt, a
 * profile photo and a speaker profile — deletes the account through the real
 * modal, then proves the teardown against the database: the rows are gone, the
 * USER row is a tombstone, payments still point at it and the auth identity is
 * deleted.
 *
 * The password-recovery check cannot be done directly: the recover endpoint
 * answers identically for known and unknown addresses by design, precisely so
 * it cannot be used to enumerate accounts. Its proxy here is proving the old
 * credentials no longer sign in and the address is free to register again.
 */

const db = serviceClient();
const users: SeededUser[] = [];

// A dev server compiles routes on first hit; keep the whole spec well clear of
// that latency without relying on a production build that AGENTS.md forbids.
test.setTimeout(180_000);
const events: SeededEvent[] = [];
const courses: SeededCourse[] = [];
const objects: Array<{ bucket: string; key: string }> = [];
const recreatedAuthIds: string[] = [];

interface Provisioned {
  sessionId: number;
  moduleId: number;
  profileId: number;
  paymentIds: number[];
}

/** Writes every record the teardown claims it removes, plus the payment it keeps. */
async function provisionAccount(user: SeededUser, event: SeededEvent, course: SeededCourse): Promise<Provisioned> {
  const { data: session, error: sErr } = await db
    .from("SUPPORT_SESSION")
    .insert({ user_id: user.userId, status: "active", case_number: 100000 + Math.floor(Math.random() * 899999) })
    .select("id")
    .single();
  if (sErr || !session) throw new Error(`SUPPORT_SESSION insert failed: ${sErr?.message}`);
  const sessionId = session.id;

  const { error: c1Err } = await db
    .from("CHAT_MESSAGE")
    .insert([{ user_id: user.userId, message: "e2e help request", session_id: sessionId, support_type: "general" }]);
  if (c1Err) throw new Error(`CHAT_MESSAGE (sent) insert failed: ${c1Err.message}`);
  const { error: c2Err } = await db
    .from("CHAT_MESSAGE")
    .insert([{ recipient_user_id: user.userId, message: "e2e reply", session_id: sessionId, support_type: "general" }]);
  if (c2Err) throw new Error(`CHAT_MESSAGE (received) insert failed: ${c2Err.message}`);

  const { data: payments, error: pErr } = await db
    .from("PAYMENT")
    .insert({ user_id: user.userId, event_id: event.eventId, amount: 0, currency: "PHP", status: "paid" })
    .select("id");
  if (pErr || !payments?.length) throw new Error(`PAYMENT insert failed: ${pErr?.message}`);
  const paymentIds = payments.map((p: { id: number }) => p.id);
  const { error: tErr } = await db.from("TICKET").insert({
    payment_id: paymentIds[0],
    user_id: user.userId,
    event_id: event.eventId,
    qr_token: `e2e-delete-${randomUUID()}`,
    status: "issued",
  });
  if (tErr) throw new Error(`TICKET insert failed: ${tErr.message}`);

  const { data: profile, error: spErr } = await db
    .from("SPEAKER_PROFILE")
    .insert({ user_id: user.userId, designation: "E2E Speaker" })
    .select("id")
    .single();
  if (spErr || !profile) throw new Error(`SPEAKER_PROFILE insert failed: ${spErr?.message}`);
  const profileId = profile.id;

  const { error: esErr } = await db.from("EVENT_SPEAKER").insert({ event_id: event.eventId, speaker_profile_id: profileId });
  if (esErr) throw new Error(`EVENT_SPEAKER insert failed: ${esErr.message}`);

  const { data: module, error: mErr } = await db
    .from("MODULE")
    .insert({
      course_id: course.courseId,
      module_name: "E2E QA",
      sequence_order: 1,
      module_type: "qa",
      speaker_profile_id: profileId,
    })
    .select("id")
    .single();
  if (mErr || !module) throw new Error(`MODULE insert failed: ${mErr?.message}`);
  const moduleId = module.id;

  const { error: qErr } = await db
    .from("QA_MESSAGE")
    .insert({ event_id: event.eventId, module_id: moduleId, user_id: user.userId, message: "e2e question" });
  if (qErr) throw new Error(`QA_MESSAGE insert failed: ${qErr.message}`);

  const { data: survey, error: svErr } = await db.from("SURVEY").insert({ event_id: event.eventId }).select("id").single();
  if (svErr || !survey) throw new Error(`SURVEY insert failed: ${svErr?.message}`);
  const { error: srErr } = await db
    .from("SURVEY_RESPONSE")
    .insert({ survey_id: survey.id, user_id: user.userId, token: `e2e-survey-${randomUUID()}`, rating: 5 });
  if (srErr) throw new Error(`SURVEY_RESPONSE insert failed: ${srErr.message}`);

  const { error: eErr } = await db
    .from("EMAIL_LOG")
    .insert({ user_id: user.userId, email_type: "ticket_issued", status: "sent" });
  if (eErr) throw new Error(`EMAIL_LOG insert failed: ${eErr.message}`);

  const { error: prErr } = await db.from("PASSWORD_RESET_ATTEMPT").insert({ email: user.email });
  if (prErr) throw new Error(`PASSWORD_RESET_ATTEMPT insert failed: ${prErr.message}`);

  const photoKey = `users/${user.userId}/avatar.png`;
  // A real 1x1 PNG: profile_images only accepts image MIME types, and some
  // environments sniff the bytes, so a text blob with an image content-type is
  // not enough.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await uploadObject(db, "profile_images", photoKey, png, "image/png");
  objects.push({ bucket: "profile_images", key: photoKey });

  return { sessionId, moduleId, profileId, paymentIds };
}

async function countRows(table: string, column: string, value: string | number): Promise<number> {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

test.afterAll(async () => {
  // QA_MESSAGE and SURVEY/SURVEY_RESPONSE are not in the shared cleanup lists;
  // clear them first so EVENT can be deleted without tripping a foreign key.
  for (const u of users) {
    await db.from("QA_MESSAGE").delete().eq("user_id", u.userId);
    await db.from("SURVEY_RESPONSE").delete().eq("user_id", u.userId);
  }
  for (const e of events) {
    await db.from("SURVEY").delete().eq("event_id", e.eventId);
  }
  await cleanup(db, users, events, courses, objects);
  for (const authId of recreatedAuthIds) {
    const { error } = await db.auth.admin.deleteUser(authId);
    if (error) console.warn(`cleanup recreated auth user: ${error.message}`);
  }
});

test("deleting an account purges its personal data but keeps payments on the tombstone", async ({ page }) => {
  const user = await createUser(db, ROLES.ATTENDEE);
  const event = await createEvent(db);
  const course = await createCourse(db, event.eventId);
  users.push(user);
  events.push(event);
  courses.push(course);
  const seeded = await provisionAccount(user, event, course);

  await signIn(page, user);
  await page.goto("/user");

  // The modal gate: disabled until the phrase is typed exactly.
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Delete my account" })).toBeVisible();
  await expect(
    page.getByText("Deleting your account permanently removes your personal data. This cannot be undone."),
  ).toBeVisible();

  const input = page.getByLabel('Type "Delete My Account" to confirm');
  const confirm = page.getByRole("button", { name: "Delete Account" });
  await expect(confirm).toBeDisabled();

  await input.fill("Delete my account");
  await expect(confirm).toBeDisabled();

  await input.fill("Delete My Account");
  await expect(confirm).toBeEnabled();

  // Confirm tears the account down and signs the browser out to the landing page.
  await confirm.click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });

  // Support chat: every message referencing the user is gone, the case is ended.
  expect(await countRows("CHAT_MESSAGE", "user_id", user.userId)).toBe(0);
  expect(await countRows("CHAT_MESSAGE", "recipient_user_id", user.userId)).toBe(0);
  const { data: session } = await db.from("SUPPORT_SESSION").select("status").eq("id", seeded.sessionId).single();
  expect(session?.status).toBe("ended_by_facilitator");

  // Tickets, Q&A, surveys, email logs and reset attempts all reference the user.
  expect(await countRows("TICKET", "user_id", user.userId)).toBe(0);
  expect(await countRows("QA_MESSAGE", "user_id", user.userId)).toBe(0);
  expect(await countRows("SURVEY_RESPONSE", "user_id", user.userId)).toBe(0);
  expect(await countRows("EMAIL_LOG", "user_id", user.userId)).toBe(0);
  expect(await countRows("PASSWORD_RESET_ATTEMPT", "email", user.email)).toBe(0);

  // Speaker profile is gone and took its event assignment with it.
  expect(await countRows("SPEAKER_PROFILE", "user_id", user.userId)).toBe(0);
  expect(await countRows("EVENT_SPEAKER", "speaker_profile_id", seeded.profileId)).toBe(0);
  const { data: module } = await db.from("MODULE").select("speaker_profile_id").eq("id", seeded.moduleId).single();
  expect(module?.speaker_profile_id).toBeNull();

  // Profile-photo files are removed from storage.
  const { data: photos } = await db.storage.from("profile_images").list(`users/${user.userId}`);
  expect(photos).toHaveLength(0);

  // The USER row survives as a tombstone; payments keep pointing at it.
  const { data: tombstone } = await db
    .from("USER")
    .select("full_name, email, profile_image_url")
    .eq("id", user.userId)
    .single();
  expect(tombstone?.full_name).toBe("Deleted User");
  expect(tombstone?.email).toBe(`deleted-${user.userId}@deleted.local`);
  expect(tombstone?.profile_image_url).toBeNull();

  const { data: payments } = await db.from("PAYMENT").select("user_id").eq("user_id", user.userId);
  expect(payments?.length).toBeGreaterThan(0);
  expect(payments?.every((p: { user_id: number }) => p.user_id === user.userId)).toBe(true);
});

test("the address is free again after deletion", async ({ page }) => {
  const user = await createUser(db, ROLES.ATTENDEE);
  users.push(user);

  await signIn(page, user);
  await page.goto("/user");

  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByLabel('Type "Delete My Account" to confirm').fill("Delete My Account");
  await page.getByRole("button", { name: "Delete Account" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });

  // The identity is gone…
  const { data: identity } = await db.auth.admin.getUserById(user.authId);
  expect(identity.user).toBeNull();

  // …so the old credentials no longer sign in — the stand-in for the
  // password-recovery check, which answers identically for any address by design.
  const { data: signInData, error } = await db.auth.signInWithPassword({ email: user.email, password: user.password });
  expect(signInData.user).toBeNull();
  expect(error).toBeTruthy();

  // …and the email can be registered again, as a fresh account.
  const { data: fresh, error: createError } = await db.auth.admin.createUser({
    email: user.email,
    password: "Fresh!E2e",
    email_confirm: true,
  });
  expect(createError).toBeNull();
  expect(fresh?.user?.email).toBe(user.email);
  if (fresh?.user?.id) recreatedAuthIds.push(fresh.user.id);
});
