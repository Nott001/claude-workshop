import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(__dirname, "../supabase/migrations");

/**
 * The squashed baseline spells grants dump-style: a schema-level grant plus
 * one `GRANT ALL ON TABLE ... TO service_role` per table. There is no blanket
 * `GRANT ALL ON ALL TABLES` statement. A missing per-table grant is invisible
 * until runtime — PostgREST answers 42501 and the DAO above it sees an error
 * rather than rows, which shipped an empty landing page (anon) and a silently
 * dead password reset (PASSWORD_RESET_ATTEMPT).
 */
const BASELINE = "00001_initial_schema.sql";

function migrations(): { name: string; sql: string }[] {
  return globSync("*.sql", { cwd: DIR })
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(DIR, name), "utf8") }));
}

function tablesCreatedIn(sql: string): string[] {
  return [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"public"\."([A-Z_]+)"/gi)].map((m) => m[1]);
}

describe("migration grants", () => {
  const files = migrations();
  const all = files.map((f) => f.sql).join("\n");

  it("finds the migrations", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("is the squashed baseline plus additive migrations", () => {
    expect(files.map((f) => f.name)).toEqual([BASELINE, "00002_lesson_name.sql", "00003_qa_realtime.sql"]);
  });

  // The table grant must appear AFTER the table definition so it applies to
  // the object that exists at that point, and the schema grant anchors the
  // set of tables it extends.
  it("grants the service role all tables via per-table grants", () => {
    const missing: string[] = [];

    for (const { name, sql } of files) {
      for (const table of tablesCreatedIn(sql)) {
        const pattern = new RegExp(
          `CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?"public"\\.?"${table}"([\\s\\S]*?)GRANT ALL ON TABLE "public"\\.?"${table}" TO "service_role"`,
          "i",
        );
        if (!pattern.test(sql)) missing.push(`${table} (in ${name})`);
      }
    }

    expect(missing, `Table(s) with no explicit service_role grant in ${BASELINE}:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("anchors the grant set on the schema", () => {
    expect(all).toContain('GRANT ALL ON SCHEMA "public" TO "service_role";');
  });

  // The counterpart risk: a limiter table recording who asked for a reset must
  // not become readable by the browser-facing roles.
  it("does not expose the reset limiter to anon or authenticated", () => {
    const exposed = new RegExp(
      `GRANT[^;]+ON\\s+\\"?public\\"?\\."PASSWORD_RESET_ATTEMPT"[^;]*TO[^;]*(anon|authenticated)`,
      "i",
    );
    expect(exposed.test(all)).toBe(false);
  });
});
