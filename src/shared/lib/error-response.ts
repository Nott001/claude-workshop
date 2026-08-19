import { NextResponse } from "next/server";
import { ServiceError } from "./service-error";

/**
 * Renders a domain failure the way the auth guards render a refusal: one flat
 * `{ error: message }` body. Non-`ServiceError` exceptions are rethrown, so
 * the helper never swallows a bug as a response.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
