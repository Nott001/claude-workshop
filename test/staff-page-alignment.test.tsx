// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ROLES } from "@/shared/lib/roles";
import { expectStaffColumn } from "./helpers/staff-column";

/**
 * Every staff page sits in the same column.
 *
 * Testing `StaffPage` alone would not catch the failure this guards: the drift
 * is a page choosing not to compose it, so every page is rendered and asked.
 */
vi.mock("@/modules/auth/lib/use-role-guard", () => ({ useRoleGuard: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

vi.mock("@/modules/audit/lib/use-audit-logs", () => ({ useAuditLogs: vi.fn() }));
vi.mock("@/shared/integrations/email/use-email-logs", () => ({ useEmailLogs: vi.fn() }));
vi.mock("@/modules/community/lib/use-community-links", () => ({ useCommunityLinks: vi.fn() }));
vi.mock("@/modules/events/lib/use-event-list", () => ({ useEventList: vi.fn() }));

// The inbox opens a realtime channel of its own and the profiler polls the
// browser's memory counters; the frame around each is what is under test here,
// so both stand in as markers.
vi.mock("@/modules/chat/components/staff-support-inbox", () => ({ default: () => <div>inbox</div> }));
vi.mock("@/modules/profiler/components/profiler-panel", () => ({ ProfilerPanel: () => <div>profiler</div> }));

import { useRoleGuard } from "@/modules/auth/lib/use-role-guard";
import { useSession } from "@/modules/auth/components/session-context";
import { useAuditLogs } from "@/modules/audit/lib/use-audit-logs";
import { useEmailLogs } from "@/shared/integrations/email/use-email-logs";
import { useCommunityLinks } from "@/modules/community/lib/use-community-links";
import { useEventList } from "@/modules/events/lib/use-event-list";

import StaffAuditLogsPage from "@/app/staff/audit-logs/page";
import StaffEmailsPage from "@/app/staff/emails/page";
import StaffUsersPage from "@/app/staff/users/page";
import StaffSupportPage from "@/app/staff/support/page";
import StaffProfilerPage from "@/app/staff/profiler/page";
import { StaffCommunityListPage } from "@/modules/community/pages/staff-community-list";
import { StaffEventListPage } from "@/modules/events/pages/staff-event-list";
import { AssignedEventListPage } from "@/modules/events/pages/assigned-event-list";

const noop = () => {};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useRoleGuard).mockReturnValue({ role: ROLES.SUPER_ADMIN, allowed: true, pending: false });
  vi.mocked(useSession).mockReturnValue({ user: { id: 1, role: ROLES.SUPER_ADMIN } } as ReturnType<typeof useSession>);

  vi.mocked(useAuditLogs).mockReturnValue({
    logs: [],
    total: 0,
    loading: false,
    page: 1,
    setPage: noop,
    search: "",
    setSearch: noop,
  } as unknown as ReturnType<typeof useAuditLogs>);

  vi.mocked(useEmailLogs).mockReturnValue({
    logs: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    loadMore: noop,
    emailTypeFilter: "",
    statusFilter: "",
    setEmailTypeFilter: noop,
    setStatusFilter: noop,
    search: "",
    setSearch: noop,
  } as unknown as ReturnType<typeof useEmailLogs>);

  vi.mocked(useCommunityLinks).mockReturnValue({
    links: [],
    loading: false,
    error: null,
    reload: async () => {},
  } as unknown as ReturnType<typeof useCommunityLinks>);

  vi.mocked(useEventList).mockReturnValue({
    filteredEvents: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadMore: noop,
    activeTab: "upcoming",
    setActiveTab: noop,
    search: "",
    setSearch: noop,
  } as unknown as ReturnType<typeof useEventList>);

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [], total: 0 }) }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The guards return null when they refuse a page, so the element type is
// nullable even though every page here is rendered as allowed.
const PAGES: [string, () => React.JSX.Element | null][] = [
  ["audit logs", StaffAuditLogsPage],
  ["emails", StaffEmailsPage],
  ["users", StaffUsersPage],
  ["support", StaffSupportPage],
  ["profiler", StaffProfilerPage],
  ["community", StaffCommunityListPage],
  ["events", StaffEventListPage],
  ["assigned events", AssignedEventListPage],
];

describe("staff pages share one frame", () => {
  for (const [name, Page] of PAGES) {
    it(`${name} renders in the shared column`, () => {
      const { container } = render(<Page />);

      expectStaffColumn(container, name);
    });
  }

  it("titles every page with a single first-level heading", () => {
    for (const [name, Page] of PAGES) {
      const { container, unmount } = render(<Page />);

      expect(container.querySelectorAll("h1"), name).toHaveLength(1);
      unmount();
    }
  });
});
