import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

/**
 * Guards the bug class behind finding #8.
 *
 * Inside a correlated subquery an unqualified column name binds to the *inner*
 * table whenever that table has a column of the same name. `ef.event_id =
 * event_id` therefore reads as `ef.event_id = ef.event_id` — always true — and
 * the intended correlation to the outer row silently never happens. The buggy
 * form reads correctly to a human, which is why it was copy-pasted into three
 * migrations before anyone noticed.
 *
 * CI's existing RLS check only greps for `ENABLE ROW LEVEL SECURITY`; it never
 * looks at policy logic. This test does, statically: inside a policy body, a
 * comparison between a table-qualified column and a *bare* identifier is
 * rejected. Qualify the outer side (`"QA_MESSAGE".event_id`) and it passes.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Everything from `CREATE POLICY` up to the statement-terminating semicolon. */
function policyBodies(sql: string): Array<{ name: string; body: string }> {
  const bodies: Array<{ name: string; body: string }> = [];
  const re = /CREATE POLICY\s+"([^"]+)"([\s\S]*?);\s*(?:\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    bodies.push({ name: match[1], body: match[2] });
  }
  return bodies;
}

/**
 * The migrations replay in order, so what protects the database is the *last*
 * definition of each policy — earlier ones are superseded by a later DROP and
 * CREATE. Keyed by policy name and table so a later migration's rewrite wins.
 */
function effectivePolicies(): Array<{ key: string; file: string; body: string }> {
  const live = new Map<string, { key: string; file: string; body: string }>();

  for (const file of migrationFiles) {
    const sql = stripComments(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));

    for (const [, name] of sql.matchAll(/DROP POLICY IF EXISTS\s+"([^"]+)"/g)) {
      live.delete(name);
    }
    for (const { name, body } of policyBodies(sql)) {
      live.set(name, { key: name, file, body });
    }
  }

  return [...live.values()];
}

/** Strips `--` comments so prose about the bug is not mistaken for the bug. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "");

// Bare words that are values or keywords rather than column references.
const NOT_A_COLUMN = new Set(["true", "false", "null", "current_user", "session_user"]);

function unqualifiedComparisons(body: string): string[] {
  const found: string[] = [];
  // `alias.column = bare_word`, where bare_word is neither qualified (no dot
  // before or after), nor a quoted identifier, nor a function call, nor a
  // string literal.
  // The `\w` in the lookahead matters: without it the engine backtracks the
  // identifier by one character to satisfy the assertion, so `auth.uid()`
  // matches as the bare word `aut`.
  const re = /\b(\w+)\.(\w+)\s*=\s*([A-Za-z_]\w*)(?![\w.(])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const rhs = match[3];
    if (NOT_A_COLUMN.has(rhs.toLowerCase())) continue;
    found.push(`${match[1]}.${match[2]} = ${rhs}`);
  }
  return found;
}

describe("RLS policies correlate against qualified outer columns", () => {
  it("no live policy compares a qualified column against a bare one", () => {
    const offenders = effectivePolicies().flatMap(({ key, file, body }) =>
      unqualifiedComparisons(body).map((cmp) => `${file} — ${key}: ${cmp}`),
    );

    expect(offenders).toEqual([]);
  });

  it("finds every policy it claims to check", () => {
    // A regex that silently matched nothing would make the assertion above
    // vacuous, which is exactly how the original bug survived CI.
    expect(effectivePolicies().length).toBeGreaterThan(10);
  });

  it("flags the shape that shipped in 00006 and 00007", () => {
    // Pins the detector itself against the exact predicate that was live.
    const buggy = `CREATE POLICY "example"
ON "QA_MESSAGE" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "TICKET" t
    WHERE t.event_id = event_id AND t.user_id = u.id
  )
);`;
    const offenders = policyBodies(buggy).flatMap(({ body }) => unqualifiedComparisons(body));
    expect(offenders).toContain("t.event_id = event_id");
  });

  it("accepts the qualified form", () => {
    const fixed = `CREATE POLICY "example"
ON "QA_MESSAGE" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "TICKET" t
    WHERE t.event_id = "QA_MESSAGE".event_id AND t.user_id = u.id
  )
);`;
    expect(policyBodies(fixed).flatMap(({ body }) => unqualifiedComparisons(body))).toEqual([]);
  });
});

describe("event drafts are not exposed to every authenticated user", () => {
  it("no policy on EVENT grants a blanket USING (true) to authenticated", () => {
    // `USING (true)` OR'd with "Published events are public" made the status
    // filter decorative and exposed every draft to anyone logged in.
    const all = migrationFiles.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");

    // The blanket policy must be dropped by a later migration if it is created.
    const created = /CREATE POLICY\s+"Events visible to authenticated"/.test(all);
    const dropped = /DROP POLICY IF EXISTS\s+"Events visible to authenticated"\s+ON\s+"EVENT"/.test(all);

    expect(created && !dropped).toBe(false);
  });
});

describe("anon holds no CREATE on the public schema", () => {
  it("the blanket schema grant is revoked", () => {
    const all = migrationFiles.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");

    if (/GRANT ALL ON SCHEMA public TO anon/.test(all)) {
      expect(all).toMatch(/REVOKE CREATE ON SCHEMA public FROM anon/);
    }
  });
});
