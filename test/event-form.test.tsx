// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { EventForm, toFormValues, toEventPayload, EMPTY_EVENT_FORM } from "@/modules/events/components/event-form";
import { eventSchema } from "@/modules/events/lib/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("toEventPayload", () => {
  it("produces a body the API's eventSchema accepts", () => {
    const payload = toEventPayload({
      title: "Alpha",
      event_date: "2026-09-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Hall A",
      venue_address: "123 Main St",
      description: "All about AI",
      price: "1500.50",
      currency: "php",
      facilitator_ids: [2, 7],
      speaker_profile_ids: [3, 9],
    });

    expect(eventSchema.safeParse(payload).success).toBe(true);
    expect(payload.price).toBe(1500.5);
    expect(payload.currency).toBe("PHP");
    expect(payload.venue_address).toBe("123 Main St");
    expect(payload.description).toBe("All about AI");
    expect(payload.facilitator_ids).toEqual([2, 7]);
    expect(payload.speaker_profile_ids).toEqual([3, 9]);
  });

  it("sends null, not an empty string, for untouched nullable columns", () => {
    const payload = toEventPayload({ ...EMPTY_EVENT_FORM, title: "A", venue_name: "V" });

    expect(payload.venue_address).toBeNull();
    expect(payload.description).toBeNull();
  });

  it("treats a cleared price as free rather than NaN", () => {
    const payload = toEventPayload({ ...EMPTY_EVENT_FORM, title: "A", venue_name: "V", price: "" });

    expect(payload.price).toBe(0);
  });
});

describe("toFormValues", () => {
  it("seeds every column the form edits from a stored event", () => {
    const values = toFormValues({
      title: "Alpha",
      event_date: "2026-09-01",
      start_time: "09:00:00",
      end_time: "17:00:00",
      venue_name: "Hall A",
      venue_address: "123 Main St",
      description: "All about AI",
      price: 1500.5,
      currency: "PHP",
    });

    expect(values).toEqual({
      title: "Alpha",
      event_date: "2026-09-01",
      start_time: "09:00:00",
      end_time: "17:00:00",
      venue_name: "Hall A",
      venue_address: "123 Main St",
      description: "All about AI",
      price: "1500.5",
      currency: "PHP",
      facilitator_ids: [],
      speaker_profile_ids: [],
    });
  });

  it("seeds the selected facilitator ids from the stored event", () => {
    const values = toFormValues({ title: "Alpha", facilitator_ids: [3, 9] });

    expect(values.facilitator_ids).toEqual([3, 9]);
  });

  it("renders nullable columns as empty inputs rather than the string 'null'", () => {
    const values = toFormValues({ title: "Alpha", venue_address: null, description: null, price: 0 });

    expect(values.venue_address).toBe("");
    expect(values.description).toBe("");
    expect(values.price).toBe("0");
  });
});

describe("EventForm", () => {
  function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
    render(
      <EventForm
        heading="Create Event"
        backHref="/staff/events"
        backLabel="Back"
        submitLabel="Create Event"
        submittingLabel="Creating..."
        onSubmit={onSubmit}
      />,
    );
    return onSubmit;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // The form fetches the facilitator roster on mount; return an empty one by
    // default so the render helpers stay focused on the fields they assert on.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  const fill = (fields: Record<string, string>) => {
    for (const [label, value] of Object.entries(fields)) {
      fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
    }
  };

  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Create Event" }));

  const REQUIRED = {
    "^Title$": "Alpha",
    "^Date$": "2026-09-01",
    "Start Time": "09:00",
    "End Time": "17:00",
    "^Venue$": "Hall A",
  };

  it("offers an input for every EVENT column an admin can set at creation", () => {
    renderForm();

    for (const label of [
      /^Title$/,
      /^Date$/,
      /Start Time/,
      /End Time/,
      /^Venue$/,
      /Venue address/,
      /Description/,
      /^Price$/,
      /Currency/,
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByText(/Facilitators/)).toBeTruthy();
    expect(screen.getByText(/Speakers/)).toBeTruthy();
  });

  it("lets an admin pick facilitators to assign at creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            String(input).includes("/api/facilitators")
              ? [{ id: 3, full_name: "Fay Facilitator", email: "fay@example.com" }]
              : [],
        }),
      ),
    );
    const onSubmit = renderForm();

    fireEvent.click(await screen.findByRole("button", { name: /Select facilitators/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Fay Facilitator/ }));
    fill(REQUIRED);
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ facilitator_ids: [3] });
  });

  it("lets an admin assign speakers at creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            String(input).includes("/api/speakers?role=speaker")
              ? {
                  data: [
                    { id: 4, user_id: 2, designation: "Author", USER: { full_name: "Sam Speaker", email: "sam@example.com" } },
                  ],
                  total: 1,
                  page: 1,
                  limit: 100,
                }
              : [],
        }),
      ),
    );
    const onSubmit = renderForm();

    fireEvent.click(await screen.findByRole("button", { name: /Select speakers/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Sam Speaker/ }));
    fill(REQUIRED);
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ speaker_profile_ids: [4] });
  });

  it("submits the venue address, description, price and currency the old form dropped", async () => {
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "Venue address": "123 Main St", Description: "All about AI", "^Price$": "1500" });
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: "Alpha",
      venue_name: "Hall A",
      venue_address: "123 Main St",
      description: "All about AI",
      price: 1500,
      currency: "PHP",
    });
  });

  it("rejects an inverted time range in the form instead of letting the API 400", async () => {
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "Start Time": "17:00", "End Time": "09:00" });
    submit();

    expect(await screen.findByText("End time must be after start time.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces a failed save rather than silently staying put", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Failed to create event"));
    renderForm(onSubmit);

    fill(REQUIRED);
    submit();

    expect(await screen.findByText("Failed to create event")).toBeTruthy();
  });
});
