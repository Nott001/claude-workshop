import { NextResponse } from "next/server";
import type { RoleGuardResult } from "./types";

/**
 * Renders a refused guard as a response.
 *
 * RFC 9110 separates the two refusals: 401 means the caller is not
 * authenticated, 403 means it is authenticated but not permitted. Every route
 * used to answer 401 with a "Forbidden" body — the one pairing the spec rules
 * out — so a client could not tell "log in" from "you may not do this".
 *
 * Lives apart from `role-guard` so it stays free of the session and database
 * imports that module carries: the mapping is pure, and a route that only needs
 * to render a refusal should not pull a Supabase client in behind it.
 */
export function guardFailure(guard: Extract<RoleGuardResult, { allowed: false }>): NextResponse {
  return NextResponse.json({ error: guard.error }, { status: guard.error === "Unauthenticated" ? 401 : 403 });
}
