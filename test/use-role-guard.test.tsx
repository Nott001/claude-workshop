// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const sessionValue = vi.fn();
vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => sessionValue(),
}));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";

const admin = { id: 1, role: ROLES.ADMIN, full_name: "Ada", email: "ada@example.com", profile_image_url: null };
const attendee = { id: 2, role: ROLES.ATTENDEE, full_name: "Bo", email: "bo@example.com", profile_image_url: null };
const speaker = { id: 3, role: ROLES.SPEAKER, full_name: "Sam", email: "sam@example.com", profile_image_url: null };
const facilitator = { id: 4, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("useRoleGuard", () => {
  it("denies a signed-in user whose role is below the minimum, sending them to their role home", async () => {
    sessionValue.mockReturnValue({ user: attendee, loading: false, isSignedIn: true, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.ADMIN));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
    expect(result.current.allowed).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it("routes a speaker who fails an admin guard to the speaker events page", async () => {
    sessionValue.mockReturnValue({ user: speaker, loading: false, isSignedIn: true, signOut: vi.fn() });

    renderHook(() => useRoleGuard(ROLES.ADMIN));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/speaker/events"));
  });

  it("routes a facilitator who fails an admin guard to their assigned events page", async () => {
    sessionValue.mockReturnValue({ user: facilitator, loading: false, isSignedIn: true, signOut: vi.fn() });

    renderHook(() => useRoleGuard(ROLES.ADMIN));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/events/assigned"));
  });

  it("routes an admin who fails an exact-facilitator guard to the staff event list", async () => {
    sessionValue.mockReturnValue({ user: admin, loading: false, isSignedIn: true, signOut: vi.fn() });

    renderHook(() => useRoleGuard(ROLES.FACILITATOR, { exactRole: true }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/events"));
  });

  it("admits a signed-in user at or above the minimum", async () => {
    sessionValue.mockReturnValue({ user: admin, loading: false, isSignedIn: true, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.FACILITATOR));

    await waitFor(() => expect(result.current.allowed).toBe(true));
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.role).toBe(ROLES.ADMIN);
  });

  it("does not deny a signed-out visitor — that is the sign-out path, not a permission failure", async () => {
    sessionValue.mockReturnValue({ user: null, loading: false, isSignedIn: false, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.ADMIN));

    await waitFor(() => expect(result.current.allowed).toBe(false));
    expect(replace).not.toHaveBeenCalled();
  });

  // "Resolved to nobody" is an answer, not a wait. Reporting it as pending left
  // the page on its loading placeholder forever whenever /api/auth/me returned
  // no user for a session the middleware had already accepted.
  it("stops pending once the session resolves, even with no user", async () => {
    sessionValue.mockReturnValue({ user: null, loading: false, isSignedIn: false, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.ADMIN));

    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("stays pending while the session is still resolving", async () => {
    sessionValue.mockReturnValue({ user: null, loading: true, isSignedIn: false, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.ADMIN));

    await waitFor(() => expect(result.current.pending).toBe(true));
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not deny when a permitted user signs out while the guarded page is still mounted", async () => {
    sessionValue.mockReturnValue({ user: admin, loading: false, isSignedIn: true, signOut: vi.fn() });

    const { result, rerender } = renderHook(() => useRoleGuard(ROLES.ADMIN));
    await waitFor(() => expect(result.current.allowed).toBe(true));

    sessionValue.mockReturnValue({ user: null, loading: false, isSignedIn: false, signOut: vi.fn() });
    rerender();

    await waitFor(() => expect(result.current.allowed).toBe(false));
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to the given path instead of the role home when the role fails", async () => {
    sessionValue.mockReturnValue({ user: attendee, loading: false, isSignedIn: true, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.ADMIN, { redirectTo: "/staff/events" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/events"));
    expect(result.current.allowed).toBe(false);
  });

  it("refuses an admin when exactRole demands facilitator", async () => {
    sessionValue.mockReturnValue({ user: admin, loading: false, isSignedIn: true, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.FACILITATOR, { redirectTo: "/staff/events", exactRole: true }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/events"));
    expect(result.current.allowed).toBe(false);
  });

  it("admits an exact facilitator when exactRole is set", async () => {
    const facilitator = {
      id: 3,
      role: ROLES.FACILITATOR,
      full_name: "Fay",
      email: "fay@example.com",
      profile_image_url: null,
    };
    sessionValue.mockReturnValue({ user: facilitator, loading: false, isSignedIn: true, signOut: vi.fn() });

    const { result } = renderHook(() => useRoleGuard(ROLES.FACILITATOR, { redirectTo: "/staff/events", exactRole: true }));

    await waitFor(() => expect(result.current.allowed).toBe(true));
    expect(replace).not.toHaveBeenCalled();
  });
});
