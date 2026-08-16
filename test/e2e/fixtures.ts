import { ROLES } from "../../src/shared/lib/roles";
import { roleHome } from "../../src/modules/auth/lib/role-home";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Every run provisions its own users and event and deletes them afterwards.
 *
 * Nothing is shared or reused, which is what keeps these tests repeatable: the
 * register route returns 409 when a user already holds a ticket for an event,
 * so a suite that reused one account would pass once and fail from then on.
 *
 * The `e2e-` prefix on every name makes orphans from a crashed run identifiable.
 */

const RUN = randomUUID().slice(0, 8);
export const E2E_PREFIX = "e2e-";

export const PASSWORD = `E2e!${randomUUID()}`;

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type SeedRole = (typeof ROLES)["ATTENDEE" | "FACILITATOR" | "SPEAKER" | "ADMIN"];

export interface SeededUser {
  authId: string;
  userId: number;
  email: string;
  password: string;
  role: SeedRole;
}

/**
 * Creates a confirmed auth user and its application row.
 *
 * `email_confirm: true` matters: a user created through the normal sign-up flow
 * may need to confirm an email before they can sign in, which a test cannot do.
 * The role is written directly because ensure-user hardcodes every new user to
 * `attendee`, so there is no path to facilitator through the app itself.
 */
export async function createUser(db: SupabaseClient, role: SeedRole): Promise<SeededUser> {
  const email = `${E2E_PREFIX}${role}-${RUN}-${randomUUID().slice(0, 6)}@example.test`;

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const { data: row, error: rowError } = await db
    .from("USER")
    .insert({
      auth_user_id: data.user.id,
      email,
      full_name: `E2E ${role}`,
      role,
    })
    .select("id")
    .single();
  if (rowError || !row) throw new Error(`USER insert failed: ${rowError?.message}`);

  return { authId: data.user.id, userId: row.id, email, password: PASSWORD, role };
}

export interface SeededEvent {
  eventId: number;
  title: string;
}

export async function createEvent(db: SupabaseClient, overrides: Record<string, unknown> = {}): Promise<SeededEvent> {
  const title = `${E2E_PREFIX}event-${RUN}-${randomUUID().slice(0, 6)}`;

  const { data, error } = await db
    .from("EVENT")
    .insert({
      title,
      event_date: "2099-01-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "E2E Hall",
      price: 0,
      currency: "PHP",
      status: "active",
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`EVENT insert failed: ${error?.message}`);

  return { eventId: data.id, title };
}

export interface SeededCourse {
  courseId: number;
  name: string;
}

/**
 * A course belongs to exactly one event (COURSE.event_id) — the 1:1 contract
 * the course-ownership series is built on. See SPEC-01-COURSE-OWNERSHIP.
 */
export async function createCourse(db: SupabaseClient, eventId: number): Promise<SeededCourse> {
  const name = `${E2E_PREFIX}course-${RUN}-${randomUUID().slice(0, 6)}`;

  const { data, error } = await db.from("COURSE").insert({ course_name: name, event_id: eventId }).select("id").single();
  if (error || !data) throw new Error(`COURSE insert failed: ${error?.message}`);

  return { courseId: data.id, name };
}

/**
 * Makes a facilitator part of an event's team. Under the ownership series the
 * authoring routes 403 unless the caller is on the event, so every facilitator
 * the suites author with must be assigned first.
 */
export async function assignFacilitator(db: SupabaseClient, userId: number, eventId: number): Promise<void> {
  const { error } = await db.from("EVENT_FACILITATOR").insert({ event_id: eventId, user_id: userId, assigned_by: userId });
  if (error) throw new Error(`EVENT_FACILITATOR insert failed: ${error.message}`);
}

/**
 * Makes a speaker part of an event's team, the way the app does: a profile row
 * first, then an EVENT_SPEAKER row against that profile. The authoring routes
 * resolve a speaker by user id, so both rows must exist.
 */
export async function assignSpeaker(db: SupabaseClient, userId: number, eventId: number): Promise<void> {
  const { data: profile, error } = await db
    .from("SPEAKER_PROFILE")
    .insert({ user_id: userId, designation: "E2E Speaker" })
    .select("id")
    .single();
  if (error || !profile) throw new Error(`SPEAKER_PROFILE insert failed: ${error?.message}`);

  const { error: esError } = await db.from("EVENT_SPEAKER").insert({ event_id: eventId, speaker_profile_id: profile.id });
  if (esError) throw new Error(`EVENT_SPEAKER insert failed: ${esError.message}`);
}

/**
 * Puts a real object in a real bucket. Without this the entitlement tests prove
 * nothing: a missing object and a forbidden one both return 404, by design.
 *
 * Buckets restrict the MIME types they accept, so the caller names what it is
 * uploading: course assets allow PDFs, image buckets only images.
 */
export async function uploadObject(
  db: SupabaseClient,
  bucket: string,
  key: string,
  body: string | Uint8Array,
  contentType = "application/pdf",
): Promise<void> {
  const { error } = await db.storage.from(bucket).upload(key, new Blob([body as BlobPart], { type: contentType }), {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

/** Issues a ticket the way the application does, so status and token are real. */
export async function issueTicket(db: SupabaseClient, userId: number, eventId: number): Promise<string> {
  const { data: payment, error: pErr } = await db
    .from("PAYMENT")
    .insert({ user_id: userId, event_id: eventId, amount: 0, currency: "PHP", status: "paid" })
    .select("id")
    .single();
  if (pErr || !payment) throw new Error(`PAYMENT insert failed: ${pErr?.message}`);

  const token = `${E2E_PREFIX}${randomUUID()}`;
  const { error: tErr } = await db
    .from("TICKET")
    .insert({ payment_id: payment.id, user_id: userId, event_id: eventId, qr_token: token, status: "issued" });
  if (tErr) throw new Error(`TICKET insert failed: ${tErr.message}`);

  return token;
}

/**
 * Signs in through the real form rather than injecting a cookie, so the tests
 * exercise the same session the application issues. Requests made through the
 * page afterwards carry that session.
 *
 * The destination comes from the application's own role map rather than a
 * literal here: sign-in routes each role to its own home, so a fixture holding
 * a second copy of those paths would go red every time one of them moved.
 */
export async function signIn(page: import("@playwright/test").Page, user: SeededUser): Promise<void> {
  await page.goto("/sign-in");
  await page.locator("#signin-email").fill(user.email);
  await page.locator("#signin-password").fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Anchored to the end of the path, so a role whose home is a prefix of
  // another's — /staff/events against /staff/events/assigned — cannot pass on
  // the wrong page, while a query or hash the app appends is still tolerated.
  await page.waitForURL(new RegExp(`${roleHome(user.role)}(?:[?#]|$)`), { timeout: 20_000 });
}

/**
 * Removes everything a run created, children first so foreign keys allow it.
 * Failures here are logged rather than thrown: a teardown error must not turn a
 * passing test red, and the `e2e-` prefix makes leftovers easy to sweep.
 */
export async function cleanup(
  db: SupabaseClient,
  users: SeededUser[],
  events: SeededEvent[],
  courses: SeededCourse[] = [],
  objects: Array<{ bucket: string; key: string }> = [],
): Promise<void> {
  const eventIds = events.map((e) => e.eventId);
  const userIds = users.map((u) => u.userId);
  const courseIds = courses.map((c) => c.courseId);

  try {
    for (const o of objects) {
      await db.storage.from(o.bucket).remove([o.key]);
    }
    if (eventIds.length) {
      await db.from("TICKET").delete().in("event_id", eventIds);
      await db.from("PAYMENT").delete().in("event_id", eventIds);
      await db.from("EVENT_SPEAKER").delete().in("event_id", eventIds);
    }
    if (userIds.length) {
      // Every foreign key into USER, or the delete below is blocked by one of
      // them. AUDIT_LOG in particular uses `actor_id`, and a facilitator who
      // performed a check-in always has a row there.
      for (const [table, column] of [
        ["TICKET", "user_id"],
        ["TICKET", "checked_in_by"],
        ["PAYMENT", "user_id"],
        ["AUDIT_LOG", "actor_id"],
        ["EMAIL_LOG", "user_id"],
        ["CHAT_MESSAGE", "user_id"],
        ["CHAT_MESSAGE", "recipient_user_id"],
        ["SUPPORT_SESSION", "user_id"],
        ["SURVEY_RESPONSE", "user_id"],
        ["SPEAKER_PROFILE", "user_id"],
        ["EVENT_FACILITATOR", "user_id"],
        ["EVENT_FACILITATOR", "assigned_by"],
      ] as const) {
        const { error } = await db.from(table).delete().in(column, userIds);
        // A column that does not exist means the schema moved; surfacing it
        // beats silently leaking rows into a shared database.
        if (error) console.warn(`cleanup ${table}.${column}: ${error.message}`);
      }
    }
    if (courseIds.length) {
      const { data: modules } = await db.from("MODULE").select("id").in("course_id", courseIds);
      const moduleIds = (modules ?? []).map((m: { id: number }) => m.id);
      if (moduleIds.length) await db.from("LESSON").delete().in("module_id", moduleIds);
      await db.from("MODULE").delete().in("course_id", courseIds);
      await db.from("COURSE").delete().in("id", courseIds);
    }
    if (eventIds.length) await db.from("EVENT").delete().in("id", eventIds);

    if (userIds.length) {
      const { error } = await db.from("USER").delete().in("id", userIds);
      if (error) console.warn(`cleanup USER: ${error.message}`);
    }

    for (const u of users) {
      const { error } = await db.auth.admin.deleteUser(u.authId);
      if (error) console.warn(`cleanup auth user: ${error.message}`);
    }
  } catch (err) {
    console.warn("E2E cleanup incomplete:", err instanceof Error ? err.message : err);
  }
}
