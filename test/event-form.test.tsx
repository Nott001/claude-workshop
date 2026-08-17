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
      // Trimmed from the "09:00:00" a `time` column returns, so a form seeded
      // from a stored row equals the same form after a browser round-trip.
      start_time: "09:00",
      end_time: "17:00",
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
    render(<EventForm mode="create" submitLabel="Create Event" submittingLabel="Creating..." onSubmit={onSubmit} />);
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
      /Event description/,
      /^Price$/,
      /Currency/,
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByText(/Facilitators/)).toBeTruthy();
    expect(screen.getByText(/Speakers/)).toBeTruthy();
  });

  it("reads as the same page the event's own Details tab does", () => {
    renderForm();

    // Section order is the unification: cover, basics, pricing, team, both
    // where an event is created and where it is edited.
    const headings = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent);
    expect(headings).toEqual(["COVER IMAGE", "EVENT BASICS", "PRICING", "TEAM"]);
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

    const facilitatorSelect = (await screen.findAllByRole("combobox"))[0];
    fireEvent.change(facilitatorSelect, { target: { value: "3" } });
    const assign = screen.getAllByRole("button", { name: "Assign" }).find((button) => !(button as HTMLButtonElement).disabled);
    fireEvent.click(assign!);
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

    const speakerSelect = (await screen.findAllByRole("combobox"))[0];
    fireEvent.change(speakerSelect, { target: { value: "4" } });
    const assign = screen.getAllByRole("button", { name: "Assign" }).find((button) => !(button as HTMLButtonElement).disabled);
    fireEvent.click(assign!);
    fill(REQUIRED);
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ speaker_profile_ids: [4] });
  });

  it("submits the venue address, description, price and currency the old form dropped", async () => {
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "Venue address": "123 Main St", "Event description": "All about AI", "^Price$": "1500" });
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

  describe("cover image", () => {
    function renderWithCover(onSubmit = vi.fn().mockResolvedValue(undefined)) {
      render(<EventForm mode="create" submitLabel="Create Event" submittingLabel="Creating..." onSubmit={onSubmit} />);
      return onSubmit;
    }

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

    // jsdom implements neither, and the picker previews the file through them.
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => "blob:cover");
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    });

    it("hands the picked cover to the submit handler, which owns the upload", async () => {
      // Nothing is stored here: the object path is keyed on an event id that
      // does not exist until the POST answers.
      const onSubmit = renderWithCover();

      pickCover(imageFile());
      fill(REQUIRED);
      submit();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect((onSubmit.mock.calls[0][1] as File).name).toBe("cover.png");
    });

    it("shows a preview of the staged cover", async () => {
      renderWithCover();
      expect(screen.getByText("No cover image yet")).toBeTruthy();

      pickCover(imageFile());

      expect((await screen.findByAltText("Event cover")).getAttribute("src")).toBe("blob:cover");
    });

    it("submits without a cover when none was picked", async () => {
      const onSubmit = renderWithCover();

      fill(REQUIRED);
      submit();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][1]).toBeNull();
    });

    it("refuses a file the bucket would reject instead of staging it", async () => {
      const onSubmit = renderWithCover();

      pickCover(imageFile("notes.pdf", "application/pdf"));
      expect(await screen.findByText("Only JPEG and PNG images are allowed.")).toBeTruthy();

      fill(REQUIRED);
      submit();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][1]).toBeNull();
    });

    it("leaves the cover out of an edit form, where an existing event uploads on pick", () => {
      render(<EventForm mode="edit" submitLabel="Save changes" submittingLabel="Saving..." onSubmit={vi.fn()} />);

      expect(document.getElementById("event-cover-input")).toBeNull();
    });
  });
});
