import { describe, it, expect, vi } from "vitest";
import { listCandidates, replaceEventAssignments, isAssignedByUserId, listEventAssignments } from "@/shared/db/dao/speaker.dao";
import type { DbClient } from "@/shared/db/dao/types";

function replaceStub({
  validIds = [],
  deleteError = null,
  insertError = null,
}: { validIds?: number[]; deleteError?: unknown; insertError?: unknown } = {}) {
  const profileChain = {
    select: vi.fn(() => profileChain),
    in: vi.fn(() => profileChain),
    eq: vi.fn(() => Promise.resolve({ data: validIds.map((id) => ({ id })), error: null })),
  };
  const deleteChain = {
    eq: vi.fn(() => Promise.resolve({ error: deleteError })),
  };
  const esChain = {
    delete: vi.fn(() => deleteChain),
    insert: vi.fn(() => Promise.resolve({ error: insertError })),
  };
  const from = vi.fn((table: string) => (table === "SPEAKER_PROFILE" ? profileChain : esChain));
  return { client: { from } as unknown as DbClient, from, profileChain, esChain, deleteChain };
}

describe("speaker.dao replaceEventAssignments", () => {
  it("replaces the event's speaker set with the ids the role check returns", async () => {
    const { client, profileChain, esChain } = replaceStub({ validIds: [2, 7] });

    const ok = await replaceEventAssignments(client, 10, [2, 7, 999]);

    expect(ok).toBe(true);
    expect(profileChain.select).toHaveBeenCalledWith("id, USER(role)");
    expect(profileChain.in).toHaveBeenCalledWith("id", [2, 7, 999]);
    expect(esChain.delete).toHaveBeenCalled();
    expect(esChain.insert).toHaveBeenCalledWith([
      { event_id: 10, speaker_profile_id: 2 },
      { event_id: 10, speaker_profile_id: 7 },
    ]);
  });

  it("clears the roster without inserting when nothing passes the role check", async () => {
    const { client, esChain } = replaceStub({ validIds: [] });

    const ok = await replaceEventAssignments(client, 10, [999]);

    expect(ok).toBe(true);
    expect(esChain.delete).toHaveBeenCalled();
    expect(esChain.insert).not.toHaveBeenCalled();
  });

  it("returns false when the delete fails", async () => {
    const { client, esChain } = replaceStub({ validIds: [2], deleteError: { message: "nope" } });

    await expect(replaceEventAssignments(client, 10, [2])).resolves.toBe(false);
    expect(esChain.insert).not.toHaveBeenCalled();
  });

  it("returns false when the insert fails", async () => {
    const { client } = replaceStub({ validIds: [2], insertError: { message: "nope" } });

    await expect(replaceEventAssignments(client, 10, [2])).resolves.toBe(false);
  });
});

describe("speaker.dao isAssignedByUserId", () => {
  it("resolves the profile, then checks the assignment directly by profile id", async () => {
    const profileChain = {
      select: vi.fn(() => profileChain),
      eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: 2 }, error: null })) })),
    };
    const esChain = {
      select: vi.fn(() => esChain),
      eq: vi.fn(() => esChain),
      single: vi.fn(() => Promise.resolve({ data: { event_id: 353 }, error: null })),
    };
    const from = vi.fn((table: string) => (table === "SPEAKER_PROFILE" ? profileChain : esChain));
    const client = { from } as unknown as DbClient;

    const ok = await isAssignedByUserId(client, 881, 353);

    expect(ok).toBe(true);
    expect(profileChain.eq).toHaveBeenCalledWith("user_id", 881);
    expect(esChain.eq).toHaveBeenCalledWith("speaker_profile_id", 2);
    expect(esChain.eq).toHaveBeenCalledWith("event_id", 353);
  });

  it("returns false without querying assignments when the user has no profile", async () => {
    const profileChain = {
      select: vi.fn(() => profileChain),
      eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: { code: "PGRST116" } })) })),
    };
    const esChain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
    const from = vi.fn((table: string) => (table === "SPEAKER_PROFILE" ? profileChain : esChain));
    const client = { from } as unknown as DbClient;

    const ok = await isAssignedByUserId(client, 999, 353);

    expect(ok).toBe(false);
    expect(esChain.select).not.toHaveBeenCalled();
  });

  it("returns false when the profile is not assigned to the event", async () => {
    const profileChain = {
      select: vi.fn(() => profileChain),
      eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: 2 }, error: null })) })),
    };
    const esChain = {
      select: vi.fn(() => esChain),
      eq: vi.fn(() => esChain),
      single: vi.fn(() => Promise.resolve({ data: null, error: { code: "PGRST116" } })),
    };
    const from = vi.fn((table: string) => (table === "SPEAKER_PROFILE" ? profileChain : esChain));
    const client = { from } as unknown as DbClient;

    const ok = await isAssignedByUserId(client, 881, 353);

    expect(ok).toBe(false);
  });
});

describe("speaker.dao listEventAssignments", () => {
  it("embeds the speaker's name so the roster is displayable", async () => {
    const esChain = {
      select: vi.fn(() => esChain),
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              event_id: 10,
              speaker_profile_id: 2,
              SPEAKER_PROFILE: { id: 2, user_id: 1, USER: { full_name: "Sam Speaker" } },
            },
          ],
          error: null,
        }),
      ),
    };
    const from = vi.fn(() => esChain);
    const client = { from } as unknown as DbClient;

    const rows = await listEventAssignments(client, 10);

    expect(rows).toEqual([
      {
        event_id: 10,
        speaker_profile_id: 2,
        SPEAKER_PROFILE: { id: 2, user_id: 1, USER: { full_name: "Sam Speaker" } },
      },
    ]);
    expect(esChain.select).toHaveBeenCalledWith("*, SPEAKER_PROFILE(*, USER(full_name))");
    expect(esChain.eq).toHaveBeenCalledWith("event_id", 10);
  });
});

describe("speaker.dao listCandidates", () => {
  it("offers only profiles whose owner still holds the speaker role", async () => {
    const orderChain = {
      select: vi.fn(() => orderChain),
      eq: vi.fn(() => orderChain),
      order: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: 3,
              user_id: 1,
              designation: "Author",
              USER: { full_name: "Sam Speaker", email: "sam@example.com" },
            },
          ],
          error: null,
        }),
      ),
    };
    const from = vi.fn(() => orderChain);
    const client = { from } as unknown as DbClient;

    const rows = await listCandidates(client);

    expect(rows).toEqual([
      {
        id: 3,
        user_id: 1,
        designation: "Author",
        USER: { full_name: "Sam Speaker", email: "sam@example.com" },
      },
    ]);
    expect(orderChain.eq).toHaveBeenCalledWith("USER.role", "speaker");
  });
});
