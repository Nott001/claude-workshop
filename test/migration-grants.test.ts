import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(__dirname, "../supabase/migrations");

/**
 * 00001 ends with `GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role`,
 * which covers the tables standing at that moment and nothing later: it is a
 * one-off grant, not a default privilege. Every table created after it needs
 * its own, and a missing one is invisible until runtime — PostgREST answers
 * 42501 and the DAO above it sees an error rather than rows.
 */
const BLANKET_GRANT_FILE = "00001_initial_schema.sql";

function migrations(): { name: string; sql: string }[] {
  return globSync("*.sql", { cwd: DIR })
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(DIR, name), "utf8") }));
}

function tablesCreatedIn(sql: string): string[] {
  return [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([A-Z_]+)"/gi)].map((m) => m[1]);
}

function grantsServiceRole(allSql: string, table: string): boolean {
  const pattern = new RegExp(`GRANT[^;]+ON\\s+(?:public\\.)?"${table}"[^;]*TO[^;]*service_role`, "i");
  return pattern.test(allSql);
}

describe("migration grants", () => {
  const files = migrations();
  const all = files.map((f) => f.sql).join("\n");

  it("finds the migrations", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("the blanket service_role grant is where this test assumes", () => {
    const initial = files.find((f) => f.name === BLANKET_GRANT_FILE);
    expect(initial?.sql).toMatch(/GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role/i);
  });

  // The bug this exists to catch: PASSWORD_RESET_ATTEMPT shipped in 00020 with
  // no grant, so every read of it failed 42501 and the rate limiter — which
  // fails closed by design — silently refused every password reset.
  it("every table created after 00001 grants the service role explicitly", () => {
    const missing: string[] = [];

    for (const { name, sql } of files) {
      if (name === BLANKET_GRANT_FILE) continue;
      for (const table of tablesCreatedIn(sql)) {
        if (!grantsServiceRole(all, table)) missing.push(`${table} (created in ${name})`);
      }
    }

    expect(
      missing,
      `Table(s) created after ${BLANKET_GRANT_FILE} with no service_role grant:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  // The counterpart risk: a limiter table recording who asked for a reset must
  // not become readable by the browser-facing roles.
  it("does not expose the reset limiter to anon or authenticated", () => {
    const exposed = new RegExp(`GRANT[^;]+ON\\s+(?:public\\.)?"PASSWORD_RESET_ATTEMPT"[^;]*TO[^;]*(anon|authenticated)`, "i");
    expect(exposed.test(all)).toBe(false);
  });
});
