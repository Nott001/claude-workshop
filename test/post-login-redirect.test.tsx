// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

import { PostLoginRedirect } from "@/modules/auth/components/post-login-redirect";

function signInAs(role: string) {
  useSession.mockReturnValue({ isLoaded: true, isSignedIn: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, role }) }));
  render(<PostLoginRedirect />);
}

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// SPEC-01-A. `admin` and `super_admin` were absent from ROLE_HOME, so both
// landed on "/" after sign-in rather than their staff events list.
describe("PostLoginRedirect destination per role", () => {
  it.each([
    [ROLES.ADMIN, "/staff/events"],
    [ROLES.SUPER_ADMIN, "/staff/events"],
    [ROLES.FACILITATOR, "/staff/events/assigned"],
    [ROLES.SPEAKER, "/speaker/events"],
    [ROLES.ATTENDEE, "/home"],
  ])("sends %s to %s", async (role, dest) => {
    signInAs(role);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(dest));
  });

  it("sends an unmapped role to the root rather than nowhere", async () => {
    signInAs("wizard");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("PostLoginRedirect while the session is unresolved", () => {
  it("does not redirect before the session loads", async () => {
    useSession.mockReturnValue({ isLoaded: false, isSignedIn: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PostLoginRedirect />);

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not redirect an anonymous visitor", async () => {
    useSession.mockReturnValue({ isLoaded: true, isSignedIn: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PostLoginRedirect />);

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
