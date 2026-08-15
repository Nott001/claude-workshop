import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getRouteClient } from "@/shared/db/route-client";
import { appBaseUrl } from "@/shared/lib/app-url";
import { isSameEmail, RESEND_COOLDOWN_SECONDS } from "@/shared/lib/email";

// The browser used to call GoTrue directly, so the only thing keeping a reload
// or a second tab from re-firing a send into the hourly budget was a countdown
// that died with the page. Reading GoTrue's own pending-change record here makes
// the cooldown authoritative: a send of the address that already has an unread
// link out is refused for the same 60s wherever it comes from.
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (!guard) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    body = {};
  }
  if (typeof body.email !== "string") {
    return NextResponse.json({ ok: false, error: { status: 400, message: "Bad request" } }, { status: 400 });
  }

  const target = body.email.trim();
  // The form refuses this first, but a caller that skips the form must not be
  // let to spend a send on a change that cannot happen.
  if (isSameEmail(target, guard.email)) {
    return NextResponse.json(
      { ok: false, error: { status: 400, message: "This is already your email address." } },
      { status: 400 },
    );
  }

  const rb = await getRouteClient();
  const { data } = await rb.auth.getUser();

  const pending = data.user?.new_email?.trim() ?? "";
  if (pending && isSameEmail(pending, target)) {
    const sentAt = data.user?.email_change_sent_at ?? null;
    const elapsed = sentAt ? (Date.now() - new Date(sentAt).getTime()) / 1000 : 0;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      // The empty message is deliberate: the client's error helper maps a 429
      // before it ever reads the body, so nothing here can render as "{ }".
      return NextResponse.json({ ok: false, error: { status: 429, message: "" } }, { status: 429 });
    }
  }

  // GoTrue folds `emailRedirectTo` into the confirmation links it mails, so the
  // browser's click ends on the app callback, which exchanges the code and
  // mirrors the confirmed address onto the USER row. Without it the links
  // redirect to bare GOTRUE_SITE_URL and the app row goes stale.
  const { error } = await rb.auth.updateUser({ email: target }, { emailRedirectTo: `${appBaseUrl()}/api/auth/callback` });
  if (error) {
    const status = error.status ?? 400;
    return NextResponse.json({ ok: false, error: { status, message: error.message } }, { status });
  }

  return NextResponse.json({ ok: true });
}
