import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join("supabase/migrations", "00018_community_link_cards.sql"), "utf8");

describe("00018_community_link_cards.sql", () => {
  it("drops the event-scoped columns, keeping only the card fields", () => {
    expect(migration).toContain("DROP COLUMN event_id");
    expect(migration).toContain("DROP COLUMN platform");
    expect(migration).not.toContain("ADD COLUMN event_id");
    expect(migration).not.toContain("ADD COLUMN platform");
  });

  it("adds the description and is_hidden columns", () => {
    expect(migration).toContain("ADD COLUMN description TEXT");
    expect(migration).toContain("ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false");
  });

  it("replaces the blanket public policy with a hidden-aware one", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Community links are public" ON "COMMUNITY_LINK";');
    expect(migration).toContain('CREATE POLICY "Community links visible unless hidden"');
  });

  it("lets staff see hidden cards through a correlated subquery on the USER role", () => {
    expect(migration).toContain('"COMMUNITY_LINK".is_hidden = false');
    expect(migration).toMatch(/u\.role IN \('admin', 'super_admin'\)/);
  });

  it("keeps the anon and authenticated SELECT grants rather than redefining them", () => {
    // Grants already exist from 00001; this migration must not disturb them.
    expect(migration).not.toMatch(/GRANT SELECT ON "COMMUNITY_LINK" TO (anon|authenticated)/);
    expect(migration).not.toMatch(/REVOKE/);
  });
});
