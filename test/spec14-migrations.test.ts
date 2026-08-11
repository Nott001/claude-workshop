import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * SPEC-14 pins migration replay order by removing duplicate numbers (00009,
 * 00010 had two files each) and the user-deletion/sequence fixes, which a
 * scratch-DB dry-run would otherwise be the only place that caught. These
 * assertions cover the files and their key statements instead.
 */
const migrations = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();

const content = (name: string): string => readFileSync(join("supabase/migrations", name), "utf8");

/** The six USER-owned FKs the deletion migration must set to null. */
const userFks = [
  ["PAYMENT", "user_id"],
  ["TICKET", "user_id"],
  ["AUDIT_LOG", "actor_id"],
  ["EMAIL_LOG", "user_id"],
  ["CHAT_MESSAGE", "user_id"],
  ["QA_MESSAGE", "user_id"],
] as const;

describe("SPEC-14 migrations", () => {
  it("replays every migration exactly once under a unique number", () => {
    const prefixes = migrations.map((f) => f.slice(0, 5));
    expect(new Set(prefixes).size).toBe(migrations.length);
  });

  it("renumbers the duplicate files and adds the new ones", () => {
    expect(migrations).toEqual([
      "00001_initial_schema.sql",
      "00002_add_admin_super_admin.sql",
      "00003_update_rls_for_new_roles.sql",
      "00004_course_event_ownership.sql",
      "00005_cascade_course_delete.sql",
      "00006_support_chat_refactor.sql",
      "00007_qa_course_module.sql",
      "00008_fix_rls_correlated_policies.sql",
      "00009_case_management.sql",
      "00010_allow_realtime_chat_participants.sql",
      "00011_grant_support_case_sequence.sql",
      "00012_course_event_owned.sql",
      "00013_module_schedule.sql",
      "00014_live_session_state_course.sql",
      "00015_user_deletion_set_null.sql",
      "00016_remove_live_session_state_realtime.sql",
      "00017_remove_event_support_chat.sql",
      "00018_community_link_cards.sql",
      "00019_event_survey.sql",
    ]);
  });

  describe("00015_user_deletion_set_null.sql", () => {
    const deletion = content("00015_user_deletion_set_null.sql");

    it("sets each USER-owned FK to ON DELETE SET NULL", () => {
      for (const [table, column] of userFks) {
        const fk = `FOREIGN KEY (${column}) REFERENCES "USER"(id) ON DELETE SET NULL`;
        expect(deletion, `${table}.${column}`).toContain(`"${table}_${column}_fkey"`);
        expect(deletion, `${table}.${column}`).toContain(fk);
      }
    });

    it("frees every such column to hold a null", () => {
      for (const [table, column] of userFks) {
        expect(deletion, `${table}.${column}`).toContain(`ALTER COLUMN ${column} DROP NOT NULL`);
      }
    });

    it("owns the orphaned case sequence to its table's primary key", () => {
      expect(deletion).toContain('ALTER SEQUENCE support_case_seq OWNED BY "SUPPORT_SESSION".id;');
    });
  });

  it("00016 drops LIVE_SESSION_STATE from the realtime publication", () => {
    expect(content("00016_remove_live_session_state_realtime.sql")).toContain(
      'ALTER PUBLICATION supabase_realtime DROP TABLE "LIVE_SESSION_STATE";',
    );
  });

  describe("00017_remove_event_support_chat.sql", () => {
    const removal = content("00017_remove_event_support_chat.sql");

    it("purges event rows before the enum loses the value", () => {
      const delIdx = removal.indexOf("DELETE FROM \"CHAT_MESSAGE\" WHERE support_type = 'event';");
      const enumIdx = removal.indexOf("ALTER TYPE support_type RENAME TO support_type_legacy;");
      expect(delIdx).toBeGreaterThan(-1);
      expect(enumIdx).toBeGreaterThan(delIdx);
    });

    it("drops the event_id columns", () => {
      expect(removal).toContain('ALTER TABLE "CHAT_MESSAGE" DROP COLUMN IF EXISTS event_id;');
      expect(removal).toContain('ALTER TABLE "SUPPORT_SESSION" DROP COLUMN IF EXISTS event_id;');
    });

    it("narrows the enum to general and drops the legacy type", () => {
      expect(removal).toContain("CREATE TYPE support_type AS ENUM ('general');");
      expect(removal).toContain("DROP TYPE support_type_legacy;");
    });

    it("rebuilds the active-session uniqueness without the event scope", () => {
      expect(removal).toContain(
        'CREATE UNIQUE INDEX idx_support_session_active\n  ON "SUPPORT_SESSION"(user_id, support_type)',
      );
    });

    it("rewrites the policies and participant function without the event branch", () => {
      expect(removal).not.toContain('"CHAT_MESSAGE".event_id');
      expect(removal).not.toContain("m.event_id");
      const policyStart = removal.lastIndexOf('CREATE POLICY "Users read support messages"');
      expect(removal.slice(policyStart)).not.toContain("'event'");
    });
  });
});
