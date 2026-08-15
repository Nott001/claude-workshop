// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "7" }),
}));
vi.mock("@/modules/events/lib/use-event-registration", () => ({ useEventRegistration: vi.fn() }));

import { useEventRegistration } from "@/modules/events/lib/use-event-registration";
import { EventRegisterPage } from "@/modules/events/pages/event-register";

const baseData = {
  event: {
    event_id: 7,
    title: "Launch Day",
    event_date: "2026-09-01",
    start_time: "09:00",
    end_time: "17:00",
    venue_name: "Main Hall",
  },
  user: { user_id: 1, full_name: "Ada Lovelace", email: "ada@example.com" },
  already_registered: false,
};

function renderRegister(from?: string, overrides: Record<string, unknown> = {}) {
  (useEventRegistration as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: baseData,
    loading: false,
    agreed: false,
    setAgreed: vi.fn(),
    submitting: false,
    error: null,
    handleRegister: vi.fn(),
    ...overrides,
  });
  return render(<EventRegisterPage from={from} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// The register page is one hop past the event detail, so its own back link has
// to relay the origin rather than resolve it — otherwise a reader who came from
// the community page loses their place the moment they open and abandon it.
describe("Event register page back link", () => {
  /** A link, so the origin it relays is assertable as an href rather than as a push. */
  const backLink = () => screen.getByRole("link", { name: /back to event/i });

  it("returns to the event without an origin when none was carried in", () => {
    renderRegister();

    expect(backLink().getAttribute("href")).toBe("/events/7");
  });

  it("relays the origin back to the event so its own back link still works", () => {
    renderRegister("community");

    expect(backLink().getAttribute("href")).toBe("/events/7?from=community");
  });

  it("relays the origin from the already-registered card too", () => {
    renderRegister("tickets", { data: { ...baseData, already_registered: true } });

    fireEvent.click(screen.getByRole("button", { name: /back to event/i }));

    expect(push).toHaveBeenCalledWith("/events/7?from=tickets");
  });

  it("drops an unrecognised origin rather than putting it back in the URL", () => {
    renderRegister("https://evil.example.com");

    expect(backLink().getAttribute("href")).toBe("/events/7");
  });
});
