import { describe, it, expect } from "vitest";
import { z } from "zod";
import { badRequest } from "@/shared/lib/api-response";
import { apiResponders } from "./helpers/api-surface";

/**
 * The 23 validating routes each answered a failed parse with
 * `parsed.error.flatten()`, putting an object under `error` — the key the rest
 * of the API answers with a string. Clients read `body.error` into state typed
 * `string | null`, and because `res.json()` is `any` neither TypeScript nor a
 * test caught it: a validation failure rendered an object where a message
 * belonged.
 */
describe("badRequest", () => {
  const schema = z.object({
    title: z.string(),
    capacity: z.number(),
    items: z.array(z.object({ name: z.string() })),
  });

  function parseFailure(input: unknown): z.ZodError {
    const parsed = schema.safeParse(input);
    if (parsed.success) throw new Error("expected the schema to reject this input");
    return parsed.error;
  }

  async function errorOf(input: unknown): Promise<string> {
    const res = badRequest(parseFailure(input));
    const body = (await res.json()) as { error: unknown };
    return body.error as string;
  }

  it("answers 400 with the error as a string, never an object", async () => {
    const res = badRequest(parseFailure({}));
    const body = (await res.json()) as { error: unknown };

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
  });

  it("names the field that failed", async () => {
    expect(await errorOf({ title: 1, capacity: 2, items: [] })).toContain("title");
  });

  it("keeps the index of a failing array member", async () => {
    expect(await errorOf({ title: "t", capacity: 1, items: [{ name: "ok" }, {}] })).toContain("items[1].name");
  });

  it("separates several failures with semicolons, since the messages hold commas", async () => {
    const error = await errorOf({ title: 1, capacity: "x", items: [] });

    expect(error).toContain("; ");
    expect(error).toContain("title");
    expect(error).toContain("capacity");
  });

  // A malformed array field raises one clause per member, which would otherwise
  // put a paragraph in the client's single error slot.
  it("caps the clauses and counts the rest", async () => {
    const items = Array.from({ length: 9 }, () => ({}));
    const error = await errorOf({ title: "t", capacity: 1, items });

    expect(error.split("; ")).toHaveLength(3);
    expect(error).toContain("(+6 more)");
  });

  it("gives a root-level failure no path prefix", async () => {
    const error = parseFailure("not an object");
    const res = badRequest(error);
    const body = (await res.json()) as { error: string };

    // Zod's own messages contain colons, so the absence of a prefix is only
    // visible against the issue message itself.
    expect(body.error).toBe(error.issues[0].message);
  });

  it("collapses a clause raised twice on the same path", async () => {
    const issue = { code: "custom" as const, path: ["title"], message: "Already taken", input: undefined };
    const res = badRequest(new z.ZodError([issue, issue]));

    await expect(res.json()).resolves.toEqual({ error: "title: Already taken" });
  });

  // Clients fall back with `??`, which an empty string walks straight past.
  it("still says something when there are no issues", async () => {
    const res = badRequest(new z.ZodError([]));

    await expect(res.json()).resolves.toEqual({ error: "Invalid request" });
  });
});

describe("api error bodies go through the helpers", () => {
  const files = apiResponders();

  // The routes are not the whole error surface: a route can hand back a helper's
  // response untouched, so a scan that stops at `src/app/api` watches the copies
  // and not the original.
  it("finds the routes and the helpers that answer for them", () => {
    expect(files.length).toBeGreaterThan(40);
    expect(files.map((f) => f.rel)).toEqual(
      expect.arrayContaining([
        "middleware.ts",
        "shared/lib/api-response.ts",
        "modules/auth/lib/guard-response.ts",
        "modules/courses/lib/course-access.ts",
      ]),
    );
  });

  // Centralising the rendering is the fix; this keeps a new route from
  // reintroducing the object body, and `flatten()` is deprecated in Zod 4 too.
  it("nothing renders a Zod error itself", () => {
    const offenders = files.filter((f) => /\.(flatten|format)\(\)|treeifyError/.test(f.code));

    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  // `error` holds a string. The nested `{ message }` form was the other half of
  // the same drift, and it cost three clients their own normalizer before the
  // shapes were reconciled. `auth/email/*` is exempt: its `retryAfter` and
  // `code` are data a string cannot carry, and it nests under `ok: false`.
  it("nothing puts an object under the error key", () => {
    const offenders = files
      .filter((f) => !f.rel.startsWith("app/api/auth/email/"))
      .filter((f) => /error:\s*\{\s*message/.test(f.code));

    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});
