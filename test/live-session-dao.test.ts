import { describe, it, expect, vi, beforeEach } from "vitest";
import { findStateWithLesson, setHighlight } from "@/modules/courses/db/live-session.dao";
import type { DbClient } from "@/shared/db/dao/types";

function stub(byTable: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: Array<[string, string, unknown[]]> = [];

  const from = vi.fn((table: string) => {
    const result = byTable[table] ?? { data: null };
    const chain: Record<string, unknown> = {
      single: async () => result,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of ["select", "eq", "upsert"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push([table, method, args]);
        return chain;
      };
    }
    return chain;
  });

  return { client: { from } as unknown as DbClient, calls };
}

const argsOf = (calls: Array<[string, string, unknown[]]>, table: string, method: string) =>
  calls.find(([t, m]) => t === table && m === method)?.[2];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("live-session.dao findStateWithLesson", () => {
  it("joins the highlighted lesson when the state exists", async () => {
    const { client } = stub({
      LIVE_SESSION_STATE: {
        data: {
          course_id: 4,
          highlighted_lesson_id: 7,
          updated_by: 3,
          updated_at: "2026-08-05T00:00:00Z",
          LESSON: { id: 7, description: "Intro", content_type: "pdf" },
        },
        error: null,
      },
    });

    const state = await findStateWithLesson(client, 4);

    expect(state).toMatchObject({
      course_id: 4,
      highlighted_lesson_id: 7,
      LESSON: { id: 7, description: "Intro", content_type: "pdf" },
    });
  });

  it("looks the state up by course, not by event", async () => {
    const { client, calls } = stub({ LIVE_SESSION_STATE: { data: null, error: null } });

    await findStateWithLesson(client, 4);

    expect(argsOf(calls, "LIVE_SESSION_STATE", "eq")).toEqual(["course_id", 4]);
  });

  it("answers null rather than failing when no row exists yet", async () => {
    const { client } = stub({ LIVE_SESSION_STATE: { data: null, error: { message: "PGRST116", code: "no rows" } } });

    await expect(findStateWithLesson(client, 4)).resolves.toBeNull();
  });
});

describe("live-session.dao setHighlight", () => {
  it("upserts on the course key so each course has a single state row", async () => {
    const { client, calls } = stub({ LIVE_SESSION_STATE: { data: { course_id: 4, highlighted_lesson_id: 7 }, error: null } });

    const result = await setHighlight(client, 4, 7, 3);

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ highlighted_lesson_id: 7 });
    const [payload, options] = argsOf(calls, "LIVE_SESSION_STATE", "upsert") as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(payload).toMatchObject({ course_id: 4, highlighted_lesson_id: 7, updated_by: 3 });
    expect(payload).toHaveProperty("updated_at");
    expect(options).toEqual({ onConflict: "course_id" });
  });

  it("returns the error when the write fails", async () => {
    const { client } = stub({
      LIVE_SESSION_STATE: { data: null, error: { message: "permission denied", code: "42501" } },
    });

    const result = await setHighlight(client, 4, 7, 3);

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ code: "42501" });
  });
});
