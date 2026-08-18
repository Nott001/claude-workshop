import { NextResponse } from "next/server";
import { z } from "zod";

/** Beyond this the string stops being readable in a client's one error slot. */
const MAX_CLAUSES = 3;

/**
 * Renders a failed schema parse as a 400.
 *
 * The routes each handed `parsed.error.flatten()` out directly, which put an
 * object under `error` — the key every other route answers with a string.
 * Clients read it into state typed `string | null` and `res.json()` is `any`, so
 * neither TypeScript nor a test caught the mismatch; a validation failure
 * rendered an object where a message belonged. `flatten()` is also deprecated in
 * Zod 4, so the shape was on borrowed time regardless.
 *
 * The field paths are the one thing `flatten()` carried that a bare message
 * does not, and a 400 here means a request whose body its own schema rejects —
 * so they are folded into the string rather than dropped.
 */
export function badRequest(error: z.ZodError): NextResponse {
  return NextResponse.json({ error: describeIssues(error) }, { status: 400 });
}

function describeIssues(error: z.ZodError): string {
  // A Set because one malformed field can raise the same clause on several
  // paths. `toDotPath` rather than a join: paths hold array indices and, per
  // its `PropertyKey[]` type, symbols — which `join` throws on.
  const clauses = new Set<string>();
  for (const issue of error.issues) {
    const path = z.core.toDotPath(issue.path);
    clauses.add(path ? `${path}: ${issue.message}` : issue.message);
  }

  const shown = [...clauses].slice(0, MAX_CLAUSES);
  // Separated by semicolons because the messages themselves contain commas.
  const summary = shown.join("; ");
  if (!summary) return "Invalid request";

  const hidden = clauses.size - shown.length;
  return hidden > 0 ? `${summary} (+${hidden} more)` : summary;
}
