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
    expect(files.map((f) => f.name)).toEqual([
      BASELINE,
      "00002_lesson_name.sql",
      "00003_qa_realtime.sql",
      "00004_qa_message_policy_helper.sql",
      "00005_qa_message_policy_staff.sql",
      "00006_cancel_pending_email_change.sql",
      "00007_short_qr_token.sql",
      "00008_email_change_attempt.sql",
      "00009_event_capacity.sql",
      "00010_event_mode.sql",
      "00011_event_meeting_url.sql",
      "00012_ticket_realtime_read.sql",
      "00013_messages_replica_identity.sql",
      "00014_drop_message_deleted_at.sql",
      "00015_live_state_realtime.sql",
      "00016_live_state_replica_identity.sql",
      "00017_rename_audit_actions.sql",
    ]);
  });

  // 00017 renames enum values and adds one new value; it creates no table so
  // the per-table grant sweep above is untouched, and a grant here would only
  // widen read access on an existing surface, so its absence is pinned too.
  it("adds no table grant in 00017", () => {
    const migration = migrations().find((f) => f.name === "00017_rename_audit_actions.sql")!;
    expect(migration.sql).not.toMatch(/GRANT/);
  });

  // 00007 drops the unique constraint rather than touching grants, so it must
  // not add any grant for the roles this suite guards.
  it("adds no table grant in 00007", () => {
    const migration = migrations().find((f) => f.name === "00007_short_qr_token.sql")!;
    expect(migration.sql).not.toMatch(/GRANT/);
  });

  // 00013 only switches the realtime chat tables to replica identity full so
  // filtered DELETE events can be routed; a grant there would widen who can
  // read messages, so its absence is pinned the same way 00007's is.
  it("adds no table grant in 00013", () => {
    const migration = migrations().find((f) => f.name === "00013_messages_replica_identity.sql")!;
    expect(migration.sql).not.toMatch(/GRANT/);
  });

  // 00014 drops the vestigial soft-delete columns; a grant there would widen
  // who can read messages, so its absence is pinned the same way as above.
  it("adds no table grant in 00014", () => {
    const migration = migrations().find((f) => f.name === "00014_drop_message_deleted_at.sql")!;
    expect(migration.sql).not.toMatch(/GRANT/);
  });

  // 00016 switches the room's live-state table to replica identity full so the
  // highlight broadcasts over realtime; a grant would widen who can read it,
  // so its absence is pinned like 00013's.
  it("adds no table grant in 00016", () => {
    const migration = migrations().find((f) => f.name === "00016_live_state_replica_identity.sql")!;
    expect(migration.sql).not.toMatch(/GRANT/);
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

  // The counterpart risk: a limiter table recording who asked for something
  // must not become readable by the browser-facing roles. Worse than a leak —
  // a ledger the limited party can reach is a ledger they can pad, which is
  // the failure the email-change limiter (00008) was written to end.
  it.each(["PASSWORD_RESET_ATTEMPT", "EMAIL_CHANGE_ATTEMPT"])("does not expose the %s limiter", (table) => {
    const exposed = new RegExp(`GRANT[^;]+ON\\s+\\"?public\\"?\\."${table}"[^;]*TO[^;]*(anon|authenticated)`, "i");
    expect(exposed.test(all)).toBe(false);
  });

  // RLS off would make the grant above the only thing standing between a
  // limiter row and any role that later gains a blanket table grant.
  it.each(["PASSWORD_RESET_ATTEMPT", "EMAIL_CHANGE_ATTEMPT"])("keeps row level security on for %s", (table) => {
    expect(all).toMatch(new RegExp(`ALTER TABLE "public"\\."${table}" ENABLE ROW LEVEL SECURITY`, "i"));
  });

  // The QA read policy used to subquery TICKET inline, which raised 42501 for
  // authenticated and killed realtime delivery. 00004 routes the check through
  // a SECURITY DEFINER helper instead; a grant on TICKET would make that read a
  // public surface again, so its absence was pinned. The kiosk and the ticket
  // pass are the opposite: they need the browser role to read the rows realtime
  // will deliver, so 00008 grants authenticated a scoped read. The pin becomes:
  // anon stays locked out, and the grant is scoped by the ticket_visible helper
  // rather than blanket.
  it("keeps TICKET unreadable by anon but grants authenticated a scoped read", () => {
    const anon = new RegExp(`GRANT[^;]+ON\\s+\\"?public\\"?\\.\\"TICKET\\"[^;]*TO[^;]*anon`, "i");
    expect(anon.test(all)).toBe(false);
    expect(all).toContain('GRANT SELECT ON TABLE "public"."TICKET" TO "authenticated";');
    expect(all).toContain("ticket_visible");
  });

  it("routes the QA read policy through the SECURITY DEFINER helper", () => {
    const fix = migrations().find((f) => f.name === "00004_qa_message_policy_helper.sql");
    expect(fix, "00004 must exist to hold the swap").toBeDefined();
    expect(fix!.sql).toMatch(/qa_message_visible/);
    expect(fix!.sql).toMatch(/SECURITY DEFINER/s);
    expect(fix!.sql).toMatch(/CREATE POLICY "Users read Q&A messages for their modules"/);
    expect(fix!.sql).toMatch(/USING \("public"\."qa_message_visible"\("id"\)\)/);
  });

  // The helper admits asker / event team / ticket holder, but the room also
  // lets staff in regardless of assignment, so 00005 redefines it with the
  // staff arm of the room gate. Without it, a facilitator/admin who can open
  // the room read questions via REST yet realtime never delivered INSERTs.
  it("keeps the staff arm of the room gate inside the helper", () => {
    const staff = migrations().find((f) => f.name === "00005_qa_message_policy_staff.sql");
    expect(staff, "00005 must exist to extend the helper").toBeDefined();
    expect(staff!.sql).toMatch(/CREATE OR REPLACE FUNCTION "public"\."qa_message_visible"/);
    expect(staff!.sql).toMatch(/SECURITY DEFINER/s);
    expect(staff!.sql).toMatch(/me\.role IN \('facilitator', 'admin', 'super_admin'\)/);
  });

  // The email-change cancel helper is the same SECURITY DEFINER seam. It is
  // scoped by auth.uid() (a caller can only void their own pending change) and
  // must not be callable by anon or from a service key, which carries no sub
  // claim and so could never name a user to cancel for.
  it("scopes the email-change cancel helper to the caller's own change", () => {
    const cancel = migrations().find((f) => f.name === "00006_cancel_pending_email_change.sql");
    expect(cancel, "00006 must exist to hold the helper").toBeDefined();
    expect(cancel!.sql).toMatch(/cancel_pending_email_change/);
    expect(cancel!.sql).toMatch(/SECURITY DEFINER/s);
    expect(cancel!.sql).toMatch(/auth\.uid\(\)/);
    expect(cancel!.sql).toMatch(/GRANT EXECUTE ON FUNCTION "public"\."cancel_pending_email_change"\(\) TO "authenticated"/);
    expect(cancel!.sql).not.toMatch(/TO "anon"/);
    expect(cancel!.sql).not.toMatch(/TO "service_role"/);
  });
});
