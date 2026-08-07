// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SpeakerEventRoomPage from "@/app/speaker/event/[eventId]/room/page";

const { useRoomAccess } = vi.hoisted(() => ({ useRoomAccess: vi.fn() }));

vi.mock("@/modules/events/lib/use-room-access", () => ({ useRoomAccess }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ eventId: "42" }),
  useRouter: () => ({ push: vi.fn() }),
}));

function allowRoom(overrides: Record<string, unknown> = {}) {
  useRoomAccess.mockReturnValue({
    access: "allowed",
    eventTitle: "Demo Day",
    eventDate: "",
    startTime: "",
    course: null,
    userRole: "speaker",
    eventStarted: false,
    eventEnded: false,
    elapsed: "00:00",
    remaining: "00:00",
    highlightedLessonId: null,
    settingHighlight: false,
    handleSetHighlight: vi.fn(),
    handleClearHighlight: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  allowRoom();
});

afterEach(() => {
  cleanup();
});

describe("SpeakerEventRoomPage", () => {
  it("passes the eventId route segment to the room-access hook, not undefined", () => {
    render(<SpeakerEventRoomPage />);

    expect(useRoomAccess).toHaveBeenCalledWith("42");
    expect(useRoomAccess).not.toHaveBeenCalledWith(undefined);
  });

  it("renders the room for an assigned speaker", () => {
    render(<SpeakerEventRoomPage />);

    expect(screen.getByText("Demo Day")).toBeTruthy();
  });

  it("shows the denial message when the hook denies access", () => {
    allowRoom({ access: "denied" });

    render(<SpeakerEventRoomPage />);

    expect(screen.getByText("Access denied.")).toBeTruthy();
  });
});
