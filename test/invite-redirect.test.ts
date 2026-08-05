import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/invite/route";

const original = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_APP_URL = "https://events.example.com/";
});

afterEach(() => {
  process.env = { ...original };
});

function get(query: string) {
  return GET(new Request(`https://events.example.com/invite${query}`));
}

describe("GET /invite", () => {
  it("forwards a valid token to Supabase's verification endpoint", async () => {
    const res = await get("?token=abc123def456abc123def456");
    const location = new URL(res.headers.get("location") ?? "");

    expect(location.origin).toBe("https://proj.supabase.co");
    expect(location.pathname).toBe("/auth/v1/verify");
    expect(location.searchParams.get("token")).toBe("abc123def456abc123def456");
    expect(location.searchParams.get("type")).toBe("invite");
  });

  it("returns the invitee to the auth callback, not the site root", async () => {
    // Supabase strips the path from a redirect target that is not allowlisted,
    // which is what left an earlier invite landing nowhere useful.
    const res = await get("?token=abc123def456abc123def456");
    const location = new URL(res.headers.get("location") ?? "");

    expect(location.searchParams.get("redirect_to")).toBe("https://events.example.com/api/auth/callback");
  });

  it.each([
    ["", "no token"],
    ["?token=", "empty token"],
    ["?token=short", "too short to be a token"],
    ["?token=has%20a%20space", "not URL-safe"],
    ["?token=" + "a".repeat(300), "implausibly long"],
  ])("sends %s back to sign-in (%s)", async (query) => {
    const res = await get(query);

    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_invite");
  });

  it("cannot be used as an open redirect", async () => {
    // Only the token comes from the caller; both the destination and the return
    // address are built from configuration.
    const res = await get("?token=abc123def456abc123def456&redirect_to=https://evil.example&next=https://evil.example");
    const location = new URL(res.headers.get("location") ?? "");

    expect(location.origin).toBe("https://proj.supabase.co");
    expect(location.searchParams.get("redirect_to")).toBe("https://events.example.com/api/auth/callback");
    expect(res.headers.get("location")).not.toContain("evil.example");
  });
});
