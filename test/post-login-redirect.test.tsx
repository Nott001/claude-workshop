// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

const fetchMock = vi.fn();

import { PostLoginRedirect } from "@/modules/auth/components/post-login-redirect";

function signInAs(role: string) {
  useSession.mockReturnValue({ isLoaded: true, isSignedIn: true });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1, role }) });
  vi.stubGlobal("fetch", fetchMock);
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
  ])("sends %s to %s", async (role, dest) => {
    signInAs(role);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(dest));
  });

  it("leaves an attendee on the landing page rather than reloading it", async () => {
    signInAs(ROLES.ATTENDEE);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/me"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves a signed-in user with an unmapped role on the landing page", async () => {
    signInAs("wizard");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/me"));
    expect(replace).not.toHaveBeenCalled();
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
