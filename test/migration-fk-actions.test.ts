import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

function migrationSql(name: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
}

const latestFkMigration = migrationSql("00008_fk_delete_actions.sql");

const REQUIRED_DETACHMENTS: { table: string; column: string }[] = [
  { table: "PAYMENT", column: "user_id" },
  { table: "PAYMENT", column: "event_id" },
  { table: "TICKET", column: "user_id" },
  { table: "TICKET", column: "event_id" },
  { table: "AUDIT_LOG", column: "actor_id" },
  { table: "STAFF_INVITE", column: "invited_by" },
  { table: "CHAT_MESSAGE", column: "user_id" },
  { table: "QA_MESSAGE", column: "user_id" },
  { table: "SURVEY_RESPONSE", column: "user_id" },
  { table: "EMAIL_LOG", column: "user_id" },
  { table: "SYSTEM_SETTING", column: "updated_by" },
];

// The columns that were NOT NULL when the schema was created; the migration
// must relax them or the DELETE fails with a null value before the FK acts.
const COLUMNS_NEEDING_NULLABLE = new Set([
  "PAYMENT.user_id",
  "PAYMENT.event_id",
  "TICKET.user_id",
  "TICKET.event_id",
  "AUDIT_LOG.actor_id",
  "STAFF_INVITE.invited_by",
  "CHAT_MESSAGE.user_id",
  "QA_MESSAGE.user_id",
  "SURVEY_RESPONSE.user_id",
  "EMAIL_LOG.user_id",
]);

describe("deletion FK actions", () => {
  it.each(REQUIRED_DETACHMENTS)("$table.$column detaches (ON DELETE SET NULL) so deletes never 500", ({ table, column }) => {
    const fkName = `${table}_${column}_fkey`;
    expect(latestFkMigration, `${fkName} must be re-added with SET NULL`).toContain(`ADD CONSTRAINT "${fkName}"`);
    expect(latestFkMigration, `${fkName} must drop the record, not destroy it`).toContain("ON DELETE SET NULL");
  });

  it("relaxes every column that was NOT NULL", () => {
    for (const key of COLUMNS_NEEDING_NULLABLE) {
      const [table, column] = key.split(".");
      expect(latestFkMigration, `${table}.${column} must become nullable`).toContain(
        `ALTER TABLE "${table}" ALTER COLUMN ${column} DROP NOT NULL;`,
      );
    }
  });

  it("never cascades away payment, ticket, or audit records", () => {
    expect(latestFkMigration).not.toContain("ON DELETE CASCADE");
  });

  it("is the only migration that redefines these constraints", () => {
    // A second migration editing the same FKs after this one would silently
    // change the policy this test pins down.
    for (const { table, column } of REQUIRED_DETACHMENTS) {
      const fkName = `${table}_${column}_fkey`;
      for (const file of ["00006_support_chat_refactor.sql", "00007_qa_course_module.sql"]) {
        expect(migrationSql(file), `${file} must not touch ${fkName}`).not.toContain(fkName);
      }
    }
  });
});
