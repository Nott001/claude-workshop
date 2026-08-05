import { describe, it, expect } from "vitest";
import * as eventDao from "@/shared/db/dao/event.dao";

/**
 * `resolveAccess` now calls this before it resolves the caller, so what counts
 * as published decides whether a cover is served to anonymous visitors. A
 * status wrongly treated as published would expose an unannounced event's
 * artwork; one wrongly treated as draft breaks every cover on the landing page.
 */
function clientReturning(row: { status: string } | null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: async () => ({ data: row }),
  };
  return { from: () => builder } as never;
}

describe("event.dao isPublished", () => {
  it("treats an active event as published", async () => {
    await expect(eventDao.isPublished(clientReturning({ status: "active" }), 1)).resolves.toBe(true);
  });

  it("treats a finished event as published, since its page stays readable", async () => {
    await expect(eventDao.isPublished(clientReturning({ status: "complete" }), 1)).resolves.toBe(true);
  });

  it("refuses a draft", async () => {
    await expect(eventDao.isPublished(clientReturning({ status: "draft" }), 1)).resolves.toBe(false);
  });

  it("refuses an event that does not exist rather than throwing", async () => {
    await expect(eventDao.isPublished(clientReturning(null), 999)).resolves.toBe(false);
  });
});
