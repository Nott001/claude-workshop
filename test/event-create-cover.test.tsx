// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { EventFormPage } from "@/modules/events/pages/event-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/modules/auth/lib/use-role-guard", () => ({
  useRoleGuard: () => ({ role: "admin", allowed: true, pending: false }),
}));
// Passthrough, so the assertions below see the file that was picked.
vi.mock("@/shared/integrations/storage/resize-image", () => ({ resizeImage: vi.fn(async (file: File) => file) }));

function pickCover(file: File) {
  const input = document.getElementById("event-cover-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

function imageFile(name = "cover.png", type = "image/png", size = 1024) {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function fillRequired() {
  const fields: Record<string, string> = {
    "^Title$": "Alpha",
    "^Date$": "2026-09-01",
    "Start Time": "09:00",
    "End Time": "17:00",
    "^Venue$": "Hall A",
  };
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
  }
}

/** A fetch that answers the roster lookups, the create, and the upload. */
function stubFetch(upload: { ok: boolean; body: Record<string, unknown> }) {
  const fetchMock = vi.fn((...args: [string | URL, { body: FormData }?]) => {
    const url = String(args[0]);
    if (url === "/api/events") return Promise.resolve({ ok: true, json: async () => ({ id: 42 }) });
    if (url === "/api/upload/event-image") return Promise.resolve({ ok: upload.ok, json: async () => upload.body });
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  URL.createObjectURL = vi.fn(() => "blob:cover");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("creating an event with a cover image", () => {
  it("uploads the cover against the id the create call returned", async () => {
    const fetchMock = stubFetch({ ok: true, body: { url: "/api/storage/event_images/events/42/cover.png" } });

    render(<EventFormPage />);
    pickCover(imageFile());
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/upload/event-image")).toBe(true));

    const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === "/api/upload/event-image")!;
    const body = init!.body;
    // The event has to exist first: the object path is `events/<id>/cover.<ext>`.
    expect(body.get("event_id")).toBe("42");
    expect((body.get("file") as File).name).toBe("cover.png");
    expect(await screen.findByText("Event created successfully!")).toBeTruthy();
  });

  it("skips the upload entirely when no cover was picked", async () => {
    const fetchMock = stubFetch({ ok: true, body: { url: "/x" } });

    render(<EventFormPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Event created successfully!")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/upload/event-image")).toBe(false);
  });

  it("reports a failed cover without pretending the event was not created", async () => {
    // Throwing here would hand back a form whose next submit creates a second
    // event, so the failure is reported and the navigation still happens.
    stubFetch({ ok: false, body: { error: "Failed to update event cover image" } });

    render(<EventFormPage />);
    pickCover(imageFile());
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(await screen.findByText("Event created, but the cover image did not upload.")).toBeTruthy();
    expect(screen.getByText("Failed to update event cover image")).toBeTruthy();

    vi.advanceTimersByTime(3000);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/events/42"));
  });
});
