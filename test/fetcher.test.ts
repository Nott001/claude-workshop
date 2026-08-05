import { describe, it, expect, vi, afterEach } from "vitest";
import { fetcher } from "@/shared/lib/fetcher";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetcher", () => {
  it("returns the parsed JSON body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hello: "world" }) }));

    await expect(fetcher("/api/things")).resolves.toEqual({ hello: "world" });
  });

  it("throws with the status when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }));

    await expect(fetcher("/api/things")).rejects.toThrow("Request failed: 404 Not Found");
  });
});
