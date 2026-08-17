import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_ROLES } from "@/shared/lib/roles";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

const MIGRATIONS_DIR = "supabase/migrations";

/**
 * The declared order of `user_role`, as Postgres would hold it after every
 * migration has run.
 *
 * Every file is read, not just the baseline. A new role cannot arrive by
 * editing 00001 — that is forbidden — so it arrives as `ALTER TYPE … ADD VALUE`
 * in a later file, and Postgres appends that to the *end* of the sort order
 * unless it is given BEFORE or AFTER. Reading only the baseline would miss
 * precisely the change this file exists to catch.
 *
 * Takes the SQL rather than reading it, so the parsing can be tested against a
 * role nobody has added yet.
 */
export function declaredRoles(migrations: string[]): string[] {
  let roles: string[] = [];

  for (const sql of migrations) {
    const created = /CREATE TYPE "?public"?\."?user_role"? AS ENUM \(([^)]*)\)/i.exec(sql);
    if (created) {
      roles = [...created[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    }

    // `IF NOT EXISTS` and the placement clause are both optional in the grammar.
    const added = sql.matchAll(
      /ALTER TYPE "?public"?\."?user_role"? ADD VALUE (?:IF NOT EXISTS )?'([a-z_]+)'(?:\s+(BEFORE|AFTER)\s+'([a-z_]+)')?/gi,
    );

    for (const [, value, placement, anchor] of added) {
      const at = anchor ? roles.indexOf(anchor) : -1;
      if (at === -1) {
        roles.push(value);
      } else {
        roles.splice(placement?.toUpperCase() === "BEFORE" ? at : at + 1, 0, value);
      }
    }
  }

  return roles;
}

function migrationSql(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
}

/**
 * The roster sorts by authority by asking Postgres to order the `role` column
 * descending, which works only because an enum sorts by the order its members
 * were declared in and `user_role` was declared from least authority to most.
 *
 * The coupling is invisible from either side: the migration reads as an
 * arbitrary list, and the DAO's `.order("role")` reads as an ordinary sort. So
 * the two orders are compared rather than trusted.
 */
describe("user_role is declared in the order the app ranks it", () => {
  it("matches ALL_ROLES member for member", () => {
    expect(declaredRoles(migrationSql())).toEqual([...ALL_ROLES]);
  });

  // ALL_ROLES is only a list; this pins that the list really is the ladder, so
  // the migration is being compared against authority and not against itself.
  it("is the same ladder hasMinRole reads", () => {
    const declared = declaredRoles(migrationSql());

    for (let i = 1; i < declared.length; i++) {
      const lower = declared[i - 1] as (typeof ALL_ROLES)[number];
      const higher = declared[i] as (typeof ALL_ROLES)[number];

      expect(hasMinRole(higher, lower), `${higher} should clear ${lower}`).toBe(true);
      expect(hasMinRole(lower, higher), `${lower} should not clear ${higher}`).toBe(false);
    }
  });
});

// A guard that cannot see the statement it guards against is no guard, so the
// reading is exercised on the migration nobody has written yet.
describe("reading a role added by a later migration", () => {
  const BASELINE = `CREATE TYPE "public"."user_role" AS ENUM ('attendee', 'speaker', 'admin');`;

  it("appends one added without a placement, as Postgres does", () => {
    expect(declaredRoles([BASELINE, `ALTER TYPE "public"."user_role" ADD VALUE 'moderator';`])).toEqual([
      "attendee",
      "speaker",
      "admin",
      "moderator",
    ]);
  });

  it("places one added BEFORE or AFTER an existing member", () => {
    expect(declaredRoles([BASELINE, `ALTER TYPE "public"."user_role" ADD VALUE 'moderator' BEFORE 'admin';`])).toEqual([
      "attendee",
      "speaker",
      "moderator",
      "admin",
    ]);

    expect(
      declaredRoles([BASELINE, `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'moderator' AFTER 'attendee';`]),
    ).toEqual(["attendee", "moderator", "speaker", "admin"]);
  });

  // The failure the guard exists for: a role appended to the end of the enum
  // sorts as the most senior, so the roster would open on moderators.
  it("reports an order the app's ladder would disagree with", () => {
    const declared = declaredRoles([BASELINE, `ALTER TYPE "public"."user_role" ADD VALUE 'moderator';`]);

    expect(declared).not.toEqual(["attendee", "speaker", "moderator", "admin"]);
  });
});
