import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASELINE = readFileSync(join("supabase/migrations", "00001_initial_schema.sql"), "utf8");

describe("community link cards (the chain's 00018 squashed into 00001)", () => {
  it("defines event-scoped columns away, keeping only the card fields", () => {
    const def = BASELINE.slice(
      BASELINE.indexOf('CREATE TABLE IF NOT EXISTS "public"."COMMUNITY_LINK"'),
      BASELINE.indexOf('CREATE TABLE IF NOT EXISTS "public"."COURSE"'),
    );
    expect(def).not.toContain("event_id");
    expect(def).not.toContain("platform");
    expect(def).toContain('"description" "text"');
    expect(def).toContain('"is_hidden" boolean DEFAULT false NOT NULL');
  });

  it("is guarded by the hidden-aware policy, not a blanket public one", () => {
    expect(BASELINE).toContain('CREATE POLICY "Community links visible unless hidden"');
    expect(BASELINE).not.toContain('CREATE POLICY "Community links are public"');
  });

  it("lets staff see hidden cards through a correlated subquery on the USER role", () => {
    const policy = BASELINE.slice(
      BASELINE.indexOf('CREATE POLICY "Community links visible unless hidden"'),
      BASELINE.indexOf(";", BASELINE.indexOf('CREATE POLICY "Community links visible unless hidden"')),
    );
    expect(policy).toContain('("is_hidden" = false)');
    expect(policy).toMatch(/ARRAY\['admin'::"public"\."user_role", 'super_admin'::"public"\."user_role"\]/);
  });

  it("keeps the anon and authenticated SELECT grants the dump spells per-table", () => {
    expect(BASELINE).toContain('GRANT SELECT ON TABLE "public"."COMMUNITY_LINK" TO "anon";');
    expect(BASELINE).toContain('GRANT SELECT ON TABLE "public"."COMMUNITY_LINK" TO "authenticated";');
  });
});
