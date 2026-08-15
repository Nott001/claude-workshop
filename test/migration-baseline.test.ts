import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/**
 * Mirrors the CI rls-policy job, which greps each migration file for every
 * `CREATE TABLE` it contains and demands a matching `ENABLE ROW LEVEL
 * SECURITY` in the same file. Once the migration chain was squashed, a table
 * added without RLS would ship to the local dev stack with the same hole the
 * chain repeatedly introduced — a readable-by-anyone table that stays open
 * until a CI run parses it.
 */

describe("RLS is enabled in the file that creates each table", () => {
  it("enables RLS for every table it creates", () => {
    for (const file of migrationFiles) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

      const created = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"public"\."([A-Z_]+)"/g)].map((m) => m[1]);
      const enabled = new Set(
        [...sql.matchAll(/ALTER TABLE "public"\."([A-Z_]+)" ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]),
      );

      const missing = created.filter((t) => !enabled.has(t));
      expect(missing, `Tables created in ${file} without same-file RLS: ${missing.join(", ")}`).toEqual([]);
    }
  });

  it("finds tables to check", () => {
    // A regex that silently matched nothing would make the assertion above
    // vacuous, which is exactly how the original holes survived CI.
    const all = migrationFiles.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");
    expect([...all.matchAll(/CREATE TABLE IF NOT EXISTS "public"\."([A-Z_]+)"/g)].length).toBeGreaterThan(15);
  });
});

/**
 * Guard detail: live-session state ended up on the realtime publication by
 * accident in the chain, letting a client watch facilitator notes it could not
 * read through RLS. Membership is the live-tables-only set the chain converged
 * on, and it must survive into the baseline and any future change.
 */
describe("realtime publication membership", () => {
  it("publishes exactly the live-participant tables", () => {
    const all = migrationFiles.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");

    const added = [...all.matchAll(/ALTER PUBLICATION supabase_realtime ADD TABLE "public"\."([A-Z_]+)";/g)].map((m) => m[1]);
    expect(added).toEqual(["MODULE", "TICKET", "SUPPORT_SESSION", "CHAT_MESSAGE", "QA_MESSAGE"]);
  });
});
