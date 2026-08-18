// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const { useSession, usePathname, TopNavbar, StaffNavbar, FloatingAssistButton } = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(() => "/"),
  TopNavbar: vi.fn(() => null),
  StaffNavbar: vi.fn(() => null),
  FloatingAssistButton: vi.fn(() => null),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));
vi.mock("@/modules/shell/components/top-navbar", () => ({ TopNavbar }));
vi.mock("@/modules/shell/components/staff-navbar", () => ({ StaffNavbar }));
vi.mock("@/modules/shell/components/floating-assist-button", () => ({ FloatingAssistButton }));

import { AppShell } from "@/modules/shell/components/app-shell";

function renderShell(role: string | null) {
  useSession.mockReturnValue({
    user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
    isSignedIn: role !== null,
    signOut: vi.fn(),
  });
  return render(
    <AppShell>
      <p>page content</p>
    </AppShell>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AppShell navbar branch", () => {
  it("gives a guest the top navbar, not the staff navbar", () => {
    renderShell(null);
    expect(TopNavbar).toHaveBeenCalledTimes(1);
    expect(StaffNavbar).not.toHaveBeenCalled();
  });

  it("gives an attendee the top navbar", () => {
    renderShell(ROLES.ATTENDEE);
    expect(TopNavbar).toHaveBeenCalledTimes(1);
    expect(StaffNavbar).not.toHaveBeenCalled();
  });

  it("gives an admin the staff navbar, not the attendee top navbar", () => {
    renderShell(ROLES.ADMIN);
    expect(StaffNavbar).toHaveBeenCalledTimes(1);
    expect(TopNavbar).not.toHaveBeenCalled();
  });

  it("gives a speaker the staff navbar", () => {
    renderShell(ROLES.SPEAKER);
    expect(StaffNavbar).toHaveBeenCalledTimes(1);
    expect(TopNavbar).not.toHaveBeenCalled();
  });
});

describe("AppShell main column offset", () => {
  // Both bars stand at --spacing-navbar, so one offset clears either. It reads
  // from the token rather than repeating the number: a hardcoded 64px here is
  // what would hide the top of every page behind the bar the day one moves.
  it("clears the top navbar by the token that sets its height", () => {
    const { container } = renderShell(ROLES.ATTENDEE);
    const className = container.querySelector("main")?.className;
    expect(className).toContain("pt-navbar");
    expect(className).not.toContain("pt-16");
    expect(className).not.toContain("lg:pl-[72px]");
  });

  it("clears the staff navbar by the same token, and the rail beside it", () => {
    const { container } = renderShell(ROLES.ADMIN);
    const className = container.querySelector("main")?.className;
    expect(className).toContain("pt-navbar");
    expect(className).not.toContain("pt-16");
    expect(className).toContain("lg:pl-[72px]");
  });
});

describe("AppShell credential screens", () => {
  it.each(["/sign-in", "/sign-up", "/staff-login", "/forgot-password", "/reset-password"])(
    "renders %s bare, without a navbar to sign in from",
    (path) => {
      usePathname.mockReturnValue(path);

      const { container } = renderShell(null);

      expect(TopNavbar).not.toHaveBeenCalled();
      expect(StaffNavbar).not.toHaveBeenCalled();
      expect(container.querySelector("main")).toBeNull();
      expect(container.textContent).toContain("page content");
    },
  );

  it("keeps the navbar on a page that merely links to one", () => {
    usePathname.mockReturnValue("/");

    renderShell(null);

    expect(TopNavbar).toHaveBeenCalledTimes(1);
  });
});

describe("AppShell full-screen surfaces", () => {
  it.each([
    ["/courses/9/room", "course room"],
    ["/staff/events/7/kiosk", "kiosk"],
  ])("renders %s bare so the %s bar is the only bar", (path) => {
    usePathname.mockReturnValue(path);

    const { container } = renderShell(ROLES.FACILITATOR);

    expect(TopNavbar).not.toHaveBeenCalled();
    expect(StaffNavbar).not.toHaveBeenCalled();
    expect(container.querySelector("main")).toBeNull();
    expect(container.textContent).toContain("page content");
  });

  it("keeps the chrome on the event page the kiosk opens from", () => {
    usePathname.mockReturnValue("/staff/events/7");

    renderShell(ROLES.FACILITATOR);

    expect(StaffNavbar).toHaveBeenCalledTimes(1);
  });
});

describe("AppShell assist button", () => {
  it("offers assistance to a guest reading an ordinary page", () => {
    usePathname.mockReturnValue("/events");

    renderShell(null);

    expect(FloatingAssistButton).toHaveBeenCalledTimes(1);
  });

  it("offers assistance to an attendee", () => {
    usePathname.mockReturnValue("/");

    renderShell(ROLES.ATTENDEE);

    expect(FloatingAssistButton).toHaveBeenCalledTimes(1);
  });

  it.each([ROLES.SPEAKER, ROLES.ADMIN])("withholds it from %s, who answer the questions", (role) => {
    usePathname.mockReturnValue("/staff/events");

    renderShell(role);

    expect(FloatingAssistButton).not.toHaveBeenCalled();
  });

  // These were listed a second time for the assist button alone. They render
  // bare, so the early return is what withholds it — the list never was.
  it.each(["/sign-in", "/reset-password", "/courses/9/room", "/staff/events/7/kiosk"])(
    "withholds it on %s, which renders without any chrome",
    (path) => {
      usePathname.mockReturnValue(path);

      renderShell(ROLES.ATTENDEE);

      expect(FloatingAssistButton).not.toHaveBeenCalled();
    },
  );
});
