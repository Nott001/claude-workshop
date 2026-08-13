import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Migration replay order was pinned by removing duplicate numbers (00009,
 * 00010 had two files each) and the user-deletion/sequence fixes, which a
 * scratch-DB dry-run would otherwise be the only place that caught. The 00001–
 * 00021 chain was later squashed into a single baseline; these assertions keep
 * pinning the replay of that file and the statements that survived into it.
 */
const migrations = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Normalise line endings: the migrations are checked out with CRLF on Windows,
// so any multi-line `toContain` would otherwise never match a fragment.
const content = (name: string): string => readFileSync(join("supabase/migrations", name), "utf8").replace(/\r\n/g, "\n");

/** The six USER-owned FKs the deletion migration made SET NULL. */
const userFks = [
  ["PAYMENT", "user_id"],
  ["TICKET", "user_id"],
  ["AUDIT_LOG", "actor_id"],
  ["EMAIL_LOG", "user_id"],
  ["CHAT_MESSAGE", "user_id"],
  ["QA_MESSAGE", "user_id"],
] as const;

describe("migration replay", () => {
  it("replays every migration exactly once under a unique number", () => {
    const prefixes = migrations.map((f) => f.slice(0, 5));
    expect(new Set(prefixes).size).toBe(migrations.length);
  });

  it("is exactly the single squashed baseline", () => {
    expect(migrations).toEqual(["00001_initial_schema.sql"]);
  });

  describe("user-deletion final state (was 00015)", () => {
    const baseline = content("00001_initial_schema.sql");

    it("sets each USER-owned FK to ON DELETE SET NULL", () => {
      for (const [table, column] of userFks) {
        const fk = `REFERENCES "public"."USER"("id") ON DELETE SET NULL`;
        expect(baseline, `${table}.${column}`).toContain(`"${table}_${column}_fkey"`);
        expect(baseline, `${table}.${column}`).toContain(`FOREIGN KEY ("${column}")`);
        expect(baseline, `${table}.${column}`).toContain(fk);
      }
    });

    it("owns the orphaned case sequence to its table's primary key", () => {
      expect(baseline).toContain('ALTER SEQUENCE "public"."support_case_seq" OWNED BY "public"."SUPPORT_SESSION"."id";');
    });

    it("makes the case_number column default from the owned sequence", () => {
      expect(baseline).toContain(
        'ALTER TABLE ONLY "public"."SUPPORT_SESSION" ALTER COLUMN "case_number" SET DEFAULT "nextval"',
      );
    });
  });

  describe("live-session-state realtime drop final state (was 00016)", () => {
    const baseline = content("00001_initial_schema.sql");

    it("keeps LIVE_SESSION_STATE out of the realtime publication", () => {
      const realtimeSection = baseline.slice(baseline.indexOf("ALTER PUBLICATION supabase_realtime"));
      expect(realtimeSection).not.toContain("LIVE_SESSION_STATE");
    });

    it("adds only the five live-participant tables to the publication", () => {
      const added = [...baseline.matchAll(/ALTER PUBLICATION supabase_realtime ADD TABLE "public"\."([A-Z_]+)";/g)].map(
        (m) => m[1],
      );
      expect(added).toEqual(["MODULE", "TICKET", "SUPPORT_SESSION", "CHAT_MESSAGE", "QA_MESSAGE"]);
    });
  });

  describe("event-support-chat removal final state (was 00017)", () => {
    const baseline = content("00001_initial_schema.sql");
    const chatDef = baseline.slice(
      baseline.indexOf('CREATE TABLE IF NOT EXISTS "public"."CHAT_MESSAGE"'),
      baseline.indexOf('CREATE TABLE IF NOT EXISTS "public"."COMMUNITY_LINK"'),
    );
    const sessionDef = baseline.slice(
      baseline.indexOf('CREATE TABLE IF NOT EXISTS "public"."SUPPORT_SESSION"'),
      baseline.indexOf('CREATE TABLE IF NOT EXISTS "public"."SURVEY"'),
    );

    it("narrows the enum to general", () => {
      expect(baseline).toMatch(/CREATE TYPE "public"."support_type" AS ENUM \(\s*'general'\s*\);/);
    });

    it("drops the event_id columns from CHAT_MESSAGE and SUPPORT_SESSION", () => {
      expect(chatDef).not.toContain("event_id");
      expect(sessionDef).not.toContain("event_id");
    });

    it("rebuilds the active-session uniqueness without the event scope", () => {
      expect(baseline).toContain('CREATE UNIQUE INDEX "idx_support_session_active" ON "public"."SUPPORT_SESSION"');
    });

    it("rewrites the policies and participant function without the event branch", () => {
      const participant = baseline.slice(baseline.indexOf("conversation_participant"));
      expect(participant).not.toContain('"CHAT_MESSAGE".event_id');
      expect(participant).not.toContain("m.event_id");

      const policy = baseline.slice(baseline.indexOf('CREATE POLICY "Users read support messages"'));
      expect(policy.split(";")[0]).toContain("'general'");
    });
  });
});
