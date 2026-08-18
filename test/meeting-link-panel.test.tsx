// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MeetingLinkPanel } from "@/modules/events/components/meeting-link-panel";

const LINK = "https://meet.google.com/abc-defg-hij";

const ok = (body: unknown = { meeting_url: LINK }) => ({ ok: true, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saveButton = () => screen.getByRole("button", { name: /save link/i });
const box = () => screen.getByLabelText(/^Link$/) as HTMLInputElement;

describe("MeetingLinkPanel", () => {
  it("seeds the box from the stored link and starts with nothing to save", () => {
    render(<MeetingLinkPanel eventId="1" initialUrl={LINK} />);

    expect(box().value).toBe(LINK);
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("starts empty for an event whose link has not been made yet", () => {
    render(<MeetingLinkPanel eventId="1" initialUrl={null} />);

    expect(box().value).toBe("");
  });

  it("PATCHes the link to the narrow endpoint, not to the event", async () => {
    const onSaved = vi.fn();
    render(<MeetingLinkPanel eventId="7" initialUrl={null} onSaved={onSaved} />);

    fireEvent.change(box(), { target: { value: LINK } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(LINK));
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/events/7/meeting-link");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ meeting_url: LINK });
  });

  it("sends null when the box is emptied, which removes the link", async () => {
    const onSaved = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ meeting_url: null })));
    render(<MeetingLinkPanel eventId="1" initialUrl={LINK} onSaved={onSaved} />);

    fireEvent.change(box(), { target: { value: "   " } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null));
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ meeting_url: null });
  });

  it("reports the flat error shape the guard answers with", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Forbidden" }) }));
    render(<MeetingLinkPanel eventId="1" initialUrl={null} />);

    fireEvent.change(box(), { target: { value: LINK } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("Forbidden")).toBeTruthy();
  });

  it("reports the nested error shape the service answers with", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Nope" }) }));
    render(<MeetingLinkPanel eventId="1" initialUrl={null} />);

    fireEvent.change(box(), { target: { value: LINK } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("Nope")).toBeTruthy();
  });

  it("keeps what was typed after a failed save, so it is not lost", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Forbidden" }) }));
    render(<MeetingLinkPanel eventId="1" initialUrl={null} />);

    fireEvent.change(box(), { target: { value: LINK } });
    fireEvent.click(saveButton());

    await screen.findByText("Forbidden");
    expect(box().value).toBe(LINK);
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("settles back to nothing to save once the link is stored", async () => {
    render(<MeetingLinkPanel eventId="1" initialUrl={null} />);

    fireEvent.change(box(), { target: { value: LINK } });
    fireEvent.click(saveButton());

    await waitFor(() => expect((saveButton() as HTMLButtonElement).disabled).toBe(true));
  });
});
