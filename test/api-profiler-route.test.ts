import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/api/dev/profiler/route";

function post(body: string | undefined) {
  return new Request("http://localhost/api/dev/profiler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/dev/profiler", () => {
  it("logs the browser summary to stdout in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await POST(post(JSON.stringify({ sample: {}, summary: "heap=1.0 MB channels=3" })));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith("[profiler] heap=1.0 MB channels=3");
  });

  it("answers 404 outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await POST(post(JSON.stringify({ summary: "heap=1.0 MB" })));

    expect(res.status).toBe(404);
    expect(log).not.toHaveBeenCalled();
  });

  it("tolerates a malformed body in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const res = await POST(post("not json"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
