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

export interface SeededUser {
  authId: string;
  userId: number;
  email: string;
  password: string;
}

/**
 * Creates a confirmed auth user and its application row.
 *
 * `email_confirm: true` matters: a user created through the normal sign-up flow
 * may need to confirm an email before they can sign in, which a test cannot do.
 * The role is written directly because ensure-user hardcodes every new user to
 * `attendee`, so there is no path to facilitator through the app itself.
 */
export async function createUser(db: SupabaseClient, role: "attendee" | "facilitator" | "speaker"): Promise<SeededUser> {
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

  return { authId: data.user.id, userId: row.id, email, password: PASSWORD };
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

/**
 * Removes everything a run created, children first so foreign keys allow it.
 * Failures here are logged rather than thrown: a teardown error must not turn a
 * passing test red, and the `e2e-` prefix makes leftovers easy to sweep.
 */
export async function cleanup(db: SupabaseClient, users: SeededUser[], events: SeededEvent[]): Promise<void> {
  const eventIds = events.map((e) => e.eventId);
  const userIds = users.map((u) => u.userId);

  try {
    if (eventIds.length) {
      await db.from("TICKET").delete().in("event_id", eventIds);
      await db.from("PAYMENT").delete().in("event_id", eventIds);
      await db.from("EVENT_SPEAKER").delete().in("event_id", eventIds);
    }
    if (userIds.length) {
      await db.from("TICKET").delete().in("user_id", userIds);
      await db.from("PAYMENT").delete().in("user_id", userIds);
      await db.from("AUDIT_LOG").delete().in("user_id", userIds);
      await db.from("EMAIL_LOG").delete().in("user_id", userIds);
    }
    if (eventIds.length) await db.from("EVENT").delete().in("id", eventIds);
    if (userIds.length) await db.from("USER").delete().in("id", userIds);

    for (const u of users) {
      await db.auth.admin.deleteUser(u.authId);
    }
  } catch (err) {
    console.warn("E2E cleanup incomplete:", err instanceof Error ? err.message : err);
  }
}
