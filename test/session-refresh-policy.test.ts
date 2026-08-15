import { describe, it, expect } from "vitest";
import { shouldRefreshRouterForAuthEvent } from "@/modules/auth/lib/refresh-policy";

describe("session refresh policy", () => {
  it("skips the router refresh on the mount-time INITIAL_SESSION event", () => {
    expect(shouldRefreshRouterForAuthEvent("INITIAL_SESSION")).toBe(false);
  });

  it("refreshes after a real session transition", () => {
    expect(shouldRefreshRouterForAuthEvent("SIGNED_IN")).toBe(true);
    expect(shouldRefreshRouterForAuthEvent("TOKEN_REFRESHED")).toBe(true);
    expect(shouldRefreshRouterForAuthEvent("PASSWORD_RECOVERY")).toBe(true);
  });

  it("also refreshes when the user's profile changes", () => {
    expect(shouldRefreshRouterForAuthEvent("USER_UPDATED")).toBe(true);
  });
});
