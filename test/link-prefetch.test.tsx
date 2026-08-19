// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));

// The auth forms build a browser client at render; none of these tests submit
// anything, so it only has to exist.
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { signInWithPassword: vi.fn(), signUp: vi.fn() } }),
}));

// `next/link` consumes `prefetch` instead of forwarding it to the anchor, so
// the prop is invisible in the rendered DOM. Standing in for the component is
// the only way to observe what each of these actually asks for.
vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    className,
    children,
  }: {
    href: string;
    prefetch?: boolean;
    className?: string;
    children: React.ReactNode;
  }) => (
    <a href={href} className={className} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

import { Navbar } from "@/modules/shell/components/navbar";
import { TopNavbar } from "@/modules/shell/components/top-navbar";
import { Brand } from "@/modules/shell/components/brand";
import { BackLink } from "@/shared/components/back-link";
import { EventCard } from "@/modules/events/components/event-card";
import { EventMemoryCard } from "@/modules/community/components/event-memory-card";
import { EventTable, type EventTableRow } from "@/modules/events/components/event-table";
import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";

function renderAs(role: string | null) {
  useSession.mockReturnValue({
    user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
    isSignedIn: role !== null,
    signOut: vi.fn(),
  });
  return render(<Navbar />);
}

function navLinks(): HTMLElement[] {
  return within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Every rail destination is a dynamic route, so Next's default `auto` prefetch
 * turns one page load into a server render per link. For an admin that is six
 * at once, and on the Workers Free plan the burst is what gets killed: a
 * 15-minute capture of production traffic caught 12 of 14 `exceededCpu`
 * invocations inside a single second, five of them these exact links.
 *
 * Prefetching only runs in production builds, so nothing in `next dev` or in a
 * browser test can catch a regression here — which is what this file is for.
 */
describe("Navbar prefetching", () => {
  it("does not prefetch any of the admin rail's six destinations", () => {
    renderAs(ROLES.ADMIN);
    const links = navLinks();
    expect(links).toHaveLength(6);
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });

  it("does not prefetch the guest rail either", () => {
    renderAs(null);
    const links = navLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });

  it("still points each item at its own destination", () => {
    renderAs(ROLES.ADMIN);
    expect(navLinks().map((a) => a.getAttribute("href"))).toEqual([
      "/staff/events",
      "/staff/users",
      "/staff/community",
      "/staff/emails",
      "/staff/support",
      "/staff/audit-logs",
    ]);
  });
});

/**
 * The rail only renders for staff; everyone else — every signed-out visitor and
 * every attendee — gets the top bar instead, carrying the same nav set. It is
 * therefore the bar, not the rail, behind the killed `/events`, `/community`
 * and `/sign-in` prefetches in that same capture.
 */
describe("TopNavbar prefetching", () => {
  function renderBarAs(role: string | null) {
    useSession.mockReturnValue({
      user: role ? { id: 1, role, full_name: "Ada Lovelace", email: "ada@example.com", profile_image_url: null } : null,
      isSignedIn: role !== null,
      signOut: vi.fn(),
    });
    return render(<TopNavbar />);
  }

  it("does not prefetch the guest bar's destinations", () => {
    renderBarAs(null);
    const links = navLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });

  it("does not prefetch the sign-in link a signed-out visitor is offered", () => {
    const { container } = renderBarAs(null);
    const signIn = within(container).getByRole("link", { name: "SIGN IN" });
    expect(signIn.dataset.prefetch).toBe("false");
  });

  it("does not prefetch the bar an attendee sees", () => {
    renderBarAs(ROLES.ATTENDEE);
    for (const link of navLinks()) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });
});

/**
 * The chrome and the cards, which between them account for the rest of what a
 * page load used to fetch speculatively. Measured against the production bundle
 * in the real runtime, three guest page loads went from 26 prefetch requests to
 * none once these were included.
 */
describe("Chrome and card prefetching", () => {
  it("does not prefetch the brand mark's link to the landing page", () => {
    const { container } = render(<Brand />);
    expect(within(container).getByRole("link").dataset.prefetch).toBe("false");
  });

  it("does not prefetch wherever a back link points", () => {
    const { container } = render(<BackLink href="/events">Back to Events</BackLink>);
    expect(within(container).getByRole("link").dataset.prefetch).toBe("false");
  });

  // One card is one server render of a detail page nobody opened, and a grid
  // brings several into view at once — the largest source of the burst.
  it("does not prefetch an event card's detail page", () => {
    const { container } = render(
      <EventCard
        eventId={615}
        title="Simple Event"
        status="published"
        date="2026-09-01"
        startTime="09:00"
        endTime="17:00"
        venueName="Startup Lab"
      />,
    );
    const link = within(container).getByRole("link");
    expect(link.getAttribute("href")).toBe("/events/615");
    expect(link.dataset.prefetch).toBe("false");
  });

  it("does not prefetch a community memory card's detail page", () => {
    const { container } = render(
      <EventMemoryCard
        event={{
          event_id: 7,
          title: "Live QA Workshop",
          event_date: "2026-05-01",
          start_time: "09:00",
          end_time: "12:00",
          venue_name: "Startup Lab",
          status: "published",
          event_type: "onsite",
          course_name: null,
          cover_image_url: null,
        }}
      />,
    );
    expect(within(container).getByRole("link").dataset.prefetch).toBe("false");
  });
});

/**
 * The per-row links. A grid, a table and a ticket list each multiply one page
 * load by however many rows it holds, which is what made these worth finding
 * separately from the chrome.
 */
describe("Per-row prefetching", () => {
  it("does not prefetch a detail page per row of the staff event table", () => {
    const rows: EventTableRow[] = [
      {
        id: 7,
        title: "Launch",
        event_date: "2026-09-01",
        start_time: "09:00",
        end_time: "17:00",
        venue_name: "Main Hall",
        status: "active",
        attendee_count: 12,
      },
      {
        id: 8,
        title: "Retro",
        event_date: "2026-08-01",
        start_time: "10:00",
        end_time: "18:00",
        venue_name: "Room B",
        status: "draft",
        attendee_count: 0,
      },
    ];
    const { container } = render(<EventTable events={rows} />);
    const rowLinks = within(container).getAllByRole("link");
    expect(rowLinks).toHaveLength(rows.length);
    for (const link of rowLinks) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });
});

/**
 * The auth screens. Two of the fourteen killed requests in the capture were
 * `/sign-up` and `/forgot-password` prefetched from the sign-in form, and both
 * carry the visitor's origin in the query string, so each prefetch asks for a
 * URL no other visitor will reuse.
 */
describe("Auth form prefetching", () => {
  it("does not prefetch the ways out of the sign-in form", () => {
    const { container } = render(<SignInForm />);
    const links = within(container).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });

  it("does not prefetch the sign-up form's links, including the two policy pages that 404", () => {
    const { container } = render(<SignUpForm />);
    const links = within(container).getAllByRole("link");
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/privacy");
    for (const link of links) {
      expect(link.dataset.prefetch).toBe("false");
    }
  });
});
