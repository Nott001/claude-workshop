// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";

vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useSession } from "@/modules/auth/components/session-context";
import StaffUsersPage from "@/app/staff/users/page";

const MEMBER = { id: 1, full_name: "Ada Admin", email: "ada@example.com", role: ROLES.ADMIN };

let invitePost: () => { ok: boolean; json: () => Promise<unknown> };

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") return { ok: true, json: async () => ({ users: [MEMBER], total: 1 }) };
      return invitePost();
    }),
  );
}

/** Opens the dialog and submits an invitation for `email`. */
async function invite(email: string) {
  fireEvent.click(screen.getByRole("button", { name: /invite member/i }));

  fireEvent.change(await screen.findByPlaceholderText("John Doe"), { target: { value: "New Person" } });
  fireEvent.change(screen.getByPlaceholderText("john@example.com"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
}

beforeEach(() => {
  vi.mocked(useRoleGuard).mockReturnValue({ role: ROLES.SUPER_ADMIN, allowed: true, pending: false });
  vi.mocked(useSession).mockReturnValue({ user: { id: 99 } } as ReturnType<typeof useSession>);
  invitePost = () => ({ ok: true, json: async () => ({ email: "new@example.com", role: ROLES.SPEAKER }) });
  installFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("staff users invite confirmation", () => {
  it("confirms the invitation, naming the address and role it went to", async () => {
    render(<StaffUsersPage />);
    await screen.findByText("ada@example.com");

    await invite("new@example.com");

    expect(await screen.findByText("Invitation sent")).toBeTruthy();
    expect(screen.getByText(`new@example.com was invited as ${ROLES.SPEAKER}.`)).toBeTruthy();
  });

  it("stays silent when the invitation was refused", async () => {
    invitePost = () => ({ ok: false, json: async () => ({ error: "A user with this email already exists" }) });

    render(<StaffUsersPage />);
    await screen.findByText("ada@example.com");

    await invite("taken@example.com");

    // The error belongs in the dialog; a confirmation here would claim a send
    // that never happened.
    expect(await screen.findByText("A user with this email already exists")).toBeTruthy();
    expect(screen.queryByText("Invitation sent")).toBeNull();
  });

  it("replaces the message when a second invitation follows the first", async () => {
    render(<StaffUsersPage />);
    await screen.findByText("ada@example.com");

    await invite("first@example.com");
    await screen.findByText(`first@example.com was invited as ${ROLES.SPEAKER}.`);

    await invite("second@example.com");

    expect(await screen.findByText(`second@example.com was invited as ${ROLES.SPEAKER}.`)).toBeTruthy();
    expect(screen.queryByText(`first@example.com was invited as ${ROLES.SPEAKER}.`)).toBeNull();
  });
});
