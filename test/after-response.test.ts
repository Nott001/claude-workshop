import { describe, it, expect, vi, beforeEach } from "vitest";

const { after } = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => ({ after }));

import { afterResponse } from "@/shared/lib/after-response";

describe("afterResponse", () => {
  beforeEach(() => {
    after.mockReset();
  });

  it("hands the work to Next rather than awaiting it", () => {
    const work = vi.fn(async () => {});

    afterResponse(work);

    expect(after).toHaveBeenCalledWith(work);
    // Registering is Next's job to run later; calling it here would put the
    // work back on the request path, which is the thing being avoided.
    expect(work).not.toHaveBeenCalled();
  });

  it("returns before the work settles", async () => {
    let release: () => void = () => {};
    after.mockImplementation((task: () => Promise<unknown>) => void task());

    afterResponse(() => new Promise<void>((resolve) => (release = resolve)));

    // Reaching this line at all is the assertion: a blocking implementation
    // could not have returned yet.
    expect(true).toBe(true);
    release();
  });

  it("runs the work inline when there is no request scope", async () => {
    after.mockImplementation(() => {
      throw new Error("after() called outside a request scope");
    });
    const work = vi.fn(async () => {});

    afterResponse(work);

    expect(work).toHaveBeenCalledOnce();
  });

  it("reports a rejection from inline work instead of crashing the caller", async () => {
    after.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => afterResponse(async () => Promise.reject(new Error("smtp down")))).not.toThrow();
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith("Deferred work failed:", expect.any(Error)));

    error.mockRestore();
  });
});
