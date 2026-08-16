import { describe, it, expect, vi } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as emailDao from "@/shared/db/dao/email.dao";
import * as passwordResetDao from "@/shared/db/dao/password-reset.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as qaMessageDao from "@/modules/courses/qa/db/qa-message.dao";
import * as surveyDao from "@/modules/surveys/db/survey.dao";

function stub(result: { data?: unknown; error?: unknown } = { data: [] }) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "eq", "delete"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  return { client: { from: vi.fn(() => chain) } as unknown as DbClient, calls };
}

const argsOf = (calls: Array<[string, unknown[]]>, method: string) => calls.find(([m]) => m === method)?.[1];
const tableOf = (client: DbClient) => (client.from as ReturnType<typeof vi.fn>).mock.calls[0][0];

const FNS: { label: string; run: (client: DbClient) => Promise<boolean> }[] = [
  { label: "ticket.dao.deleteByUser", run: (c) => ticketDao.deleteByUser(c, 7) },
  { label: "email.dao.deleteByUser", run: (c) => emailDao.deleteByUser(c, 7) },
  { label: "qa-message.dao.deleteByUser", run: (c) => qaMessageDao.deleteByUser(c, 7) },
  { label: "survey.dao.deleteResponsesByUser", run: (c) => surveyDao.deleteResponsesByUser(c, 7) },
  { label: "speaker.dao.removeByUserId", run: (c) => speakerDao.removeByUserId(c, 7) },
];

const FK_TABLES: { table: string; fn: (c: DbClient) => Promise<boolean> }[] = [
  { table: "TICKET", fn: (c) => ticketDao.deleteByUser(c, 7) },
  { table: "EMAIL_LOG", fn: (c) => emailDao.deleteByUser(c, 7) },
  { table: "QA_MESSAGE", fn: (c) => qaMessageDao.deleteByUser(c, 7) },
  { table: "SURVEY_RESPONSE", fn: (c) => surveyDao.deleteResponsesByUser(c, 7) },
  { table: "SPEAKER_PROFILE", fn: (c) => speakerDao.removeByUserId(c, 7) },
];

describe("account teardown deletes", () => {
  it("targets the right table on the service layer", async () => {
    for (const { table, fn } of FK_TABLES) {
      const { client, calls } = stub({ error: null });
      await fn(client);
      expect(tableOf(client)).toBe(table);
      expect(calls.some(([m]) => m === "delete")).toBe(true);
    }
  });

  it("filters each delete on user_id with the caller's id", async () => {
    for (const { fn } of FK_TABLES) {
      const { client, calls } = stub({ error: null });
      await fn(client);
      expect(argsOf(calls, "eq")).toEqual(["user_id", 7]);
    }
  });

  it("returns false when the delete reports an error, true otherwise", async () => {
    for (const { run } of FNS) {
      const failing = stub({ error: { message: "delete blocked" } });
      const passing = stub({ error: null });

      await expect(run(failing.client)).resolves.toBe(false);
      await expect(run(passing.client)).resolves.toBe(true);
    }
  });
});

describe("password-reset.dao.deleteByEmail", () => {
  it("deletes PASSWORD_RESET_ATTEMPT rows by the raw email address", async () => {
    const { client, calls } = stub({ error: null });

    await expect(passwordResetDao.deleteByEmail(client, "ada@example.com")).resolves.toBe(true);

    expect(tableOf(client)).toBe("PASSWORD_RESET_ATTEMPT");
    expect(argsOf(calls, "eq")).toEqual(["email", "ada@example.com"]);
  });

  it("returns false when the delete reports an error", async () => {
    const { client } = stub({ error: { message: "delete blocked" } });

    await expect(passwordResetDao.deleteByEmail(client, "ada@example.com")).resolves.toBe(false);
  });
});
