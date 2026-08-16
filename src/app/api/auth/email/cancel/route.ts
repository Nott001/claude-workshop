import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getRouteClient } from "@/shared/db/route-client";

// No body: the caller's session identifies them. Idempotent by construction —
// sheet 01's helper deletes whatever token rows exist for the caller and clears
// the pending fields, so a repeat cancel is a no-op that still answers ok.
export async function POST() {
  const guard = await requireAuth();
  if (!guard) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const rb = await getRouteClient();
  const { error } = await rb.rpc("cancel_pending_email_change");
  if (error) {
    return NextResponse.json({ ok: false, error: { status: 500, message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
