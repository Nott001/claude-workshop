import { NextResponse } from "next/server";
import type { AuthGuardResult } from "./types";

/**
 * Renders guard refusals as responses.
 *
 * RFC 9110 separates the two refusals: 401 means the caller is not
 * authenticated, 403 means it is authenticated but not permitted. Every route
 * used to answer 401 with a "Forbidden" body — the one pairing the spec rules
 * out — so a client could not tell "log in" from "you may not do this".
 *
 * `guardFailure` renders a refused guard; `forbidden` renders a denial a guard
 * cannot state (ownership, event scope), answering the same 403 body so the
 * client sees one "Forbidden".
 *
 * Lives apart from `role-guard` so it stays free of the session and database
 * imports that module carries: the mapping is pure, and a route that only needs
 * to render a refusal should not pull a Supabase client in behind it.
 */
export function guardFailure(guard: Extract<AuthGuardResult, { allowed: false }>): NextResponse {
  return NextResponse.json({ error: guard.error }, { status: guard.error === "Unauthenticated" ? 401 : 403 });
}

/**
 * Renders an entitlement denial a role guard cannot express.
 */
export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Renders a refusal a role guard cannot state: the caller passed the guard,
 * but the auth identity needed later in the handler is gone. Answers the same
 * 401 body so clients see one "Unauthenticated".
 */
export function unauthenticated(): NextResponse {
  return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
}
