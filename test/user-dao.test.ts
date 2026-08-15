import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as userDao from "@/shared/db/dao/user.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * A PostgREST builder that records the calls made against it.
 *
 * The helper in test/helpers/fake-postgrest.ts answers reads that end in
 * `select`/`eq`/`order`; these DAOs also insert, upsert, update, delete and
 * paginate, and what they pass to those is the behaviour worth pinning.
 */
// PostgREST answers an uncounted query with a null count, not an absent one.
function stub(result: { data?: unknown; error?: unknown; count?: number | null } = { data: null }) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {
    single: async () => result,
    maybeSingle: async () => result,
    // Some DAOs await the builder itself rather than a terminal.
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "eq", "in", "or", "order", "range", "update", "upsert", "insert", "delete"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, calls, from };
}

const argsOf = (calls: Array<[string, unknown[]]>, method: string) => calls.find(([m]) => m === method)?.[1];

beforeEach(() => vi.clearAllMocks());

describe("user.dao reads", () => {
  it("finds a user by their auth id", async () => {
    const { client, from, calls } = stub({ data: { id: 3, email: "a@b.c" } });

    await expect(userDao.findByAuthId(client, "auth-1")).resolves.toMatchObject({ id: 3 });
    expect(from).toHaveBeenCalledWith("USER");
    expect(argsOf(calls, "eq")).toEqual(["auth_user_id", "auth-1"]);
  });

  it("looks an address up without failing when nobody holds it", async () => {
    // maybeSingle, not single: no row is an ordinary answer here, and `single`
    // would turn it into an error.
    const { client } = stub({ data: null });

    await expect(userDao.findStaffByEmail(client, "nobody@example.test")).resolves.toBeNull();
  });

  it("reads only the id and role when that is all the caller needs", async () => {
    const { client, calls } = stub({ data: { id: 3, role: ROLES.ADMIN } });

    await userDao.findByAuthIdWithRole(client, "auth-1");

    expect(argsOf(calls, "select")).toEqual(["id, role"]);
  });
});

describe("user.dao listStaff", () => {
  it("lists staff roles only, never attendees", async () => {
    const { client, calls } = stub({ data: [], count: 0 });

    await userDao.listStaff(client, { page: 1, search: "" });

    expect(argsOf(calls, "in")).toEqual(["role", [ROLES.FACILITATOR, ROLES.SPEAKER, ROLES.ADMIN, ROLES.SUPER_ADMIN]]);
  });

  it("asks for the page the caller wanted", async () => {
    const { client, calls } = stub({ data: [], count: 0 });

    await userDao.listStaff(client, { page: 3, search: "", pageSize: 10 });

    // Page 3 of 10 starts at row 20 and ends at 29, inclusive.
    expect(argsOf(calls, "range")).toEqual([20, 29]);
  });

  it("searches the name and the address together", async () => {
    const { client, calls } = stub({ data: [], count: 0 });

    await userDao.listStaff(client, { page: 1, search: "ana" });

    // ilikePattern quotes and escapes the term so input cannot re-write the
    // or-filter; the quotes are part of the generated expression.
    expect(argsOf(calls, "or")).toEqual(['full_name.ilike."%ana%",email.ilike."%ana%"']);
  });

  it("narrows to one role and keeps pagination when role is set", async () => {
    const { client, calls } = stub({ data: [], count: 0 });

    await userDao.listStaff(client, { page: 2, search: "", pageSize: 10, role: ROLES.SPEAKER });

    const eqs = calls.filter(([m]) => m === "eq").map(([, args]) => args);
    expect(eqs).toContainEqual(["role", ROLES.SPEAKER]);
    expect(argsOf(calls, "range")).toEqual([10, 19]);
  });

  it("reports an empty page rather than null when the query returns nothing", async () => {
    const { client } = stub({ data: null, count: null });

    await expect(userDao.listStaff(client, { page: 1, search: "" })).resolves.toMatchObject({ data: [], total: 0 });
  });
});

describe("user.dao writes", () => {
  it("leaves an existing role alone when the caller supplies none", async () => {
    // ensureUser upserts on every sign-in; writing a default role here would
    // demote every member back to attendee each time they logged in.
    const { client, calls } = stub({ data: { id: 3 } });

    await userDao.upsertUser(client, { auth_user_id: "auth-1", email: "a@b.c", full_name: "Ana" });

    const [payload] = argsOf(calls, "upsert") as [Record<string, unknown>, unknown];
    expect(payload).not.toHaveProperty("role");
  });

  it("writes the role when one is given, keyed on the auth id", async () => {
    const { client, calls } = stub({ data: { id: 3 } });

    await userDao.upsertUser(client, { auth_user_id: "auth-1", email: "a@b.c", full_name: "Ana", role: ROLES.SPEAKER });

    const [payload, options] = argsOf(calls, "upsert") as [Record<string, unknown>, unknown];
    expect(payload).toMatchObject({ role: ROLES.SPEAKER });
    expect(options).toEqual({ onConflict: "auth_user_id" });
  });

  it("reports a failed upsert as no user rather than a half-built one", async () => {
    const { client } = stub({ data: null, error: { message: "conflict" } });

    await expect(userDao.upsertUser(client, { auth_user_id: "a", email: "e", full_name: "f" })).resolves.toBeNull();
  });

  it("touches only the fields an edit actually carries", async () => {
    const { client, calls } = stub({ data: { id: 3 } });

    await userDao.updateUser(client, "auth-1", { full_name: "Ana Cruz" });

    const [payload] = argsOf(calls, "update") as [Record<string, unknown>];
    expect(payload).toHaveProperty("full_name", "Ana Cruz");
    expect(payload).not.toHaveProperty("email");
    expect(payload).toHaveProperty("updated_at");
  });

  it("clears a profile photo when the edit sets it to null", async () => {
    // `undefined` means "leave it"; null is a deliberate removal, and the two
    // must not collapse into each other.
    const { client, calls } = stub({ data: { id: 3 } });

    await userDao.updateUser(client, "auth-1", { profile_image_url: null });

    const [payload] = argsOf(calls, "update") as [Record<string, unknown>];
    expect(payload).toHaveProperty("profile_image_url", null);
  });

  it("changes a role by row id", async () => {
    const { client, calls } = stub({ data: { id: 3, role: ROLES.ADMIN } });

    await userDao.updateRole(client, 3, ROLES.ADMIN);

    expect(argsOf(calls, "eq")).toEqual(["id", 3]);
    expect((argsOf(calls, "update") as [Record<string, unknown>])[0]).toMatchObject({ role: ROLES.ADMIN });
  });

  it("reports whether a delete actually happened", async () => {
    const ok = stub({ error: null });
    const failed = stub({ error: { message: "row is referenced" } });

    await expect(userDao.removeById(ok.client, 3)).resolves.toBe(true);
    await expect(userDao.removeById(failed.client, 3)).resolves.toBe(false);
  });

  it("deletes by auth id for the account-closure path", async () => {
    const { client, calls } = stub({ error: null });

    await expect(userDao.deleteByAuthId(client, "auth-1")).resolves.toBe(true);
    expect(argsOf(calls, "eq")).toEqual(["auth_user_id", "auth-1"]);
  });
});
