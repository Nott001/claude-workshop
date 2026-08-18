// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { EventForm, toFormValues, toEventPayload, EMPTY_EVENT_FORM } from "@/modules/events/components/event-form";
import type { EventFormValues } from "@/modules/events/lib/event-form-schema";
import { PRICE_STEP, stepPrice } from "@/modules/events/lib/event-form-schema";
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
      event_type: "onsite",
      event_date: "2026-09-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Hall A",
      venue_address: "123 Main St",
      meeting_url: "",
      description: "All about AI",
      price: "1500.50",
      currency: "php",
      capacity: "150",
      facilitator_ids: [2, 7],
      speaker_profile_ids: [3, 9],
    });

    expect(eventSchema.safeParse(payload).success).toBe(true);
    expect(payload.price).toBe(1500.5);
    expect(payload.currency).toBe("PHP");
    expect(payload.venue_address).toBe("123 Main St");
    expect(payload.description).toBe("All about AI");
    expect(payload.capacity).toBe(150);
    expect(payload.facilitator_ids).toEqual([2, 7]);
    expect(payload.speaker_profile_ids).toEqual([3, 9]);
  });

  it("sends an explicit null capacity for an uncapped event", () => {
    const payload = toEventPayload({
      ...EMPTY_EVENT_FORM,
      title: "A",
      event_date: "2026-09-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "V",
      capacity: "  ",
    });

    // Null rather than an omitted key: a PATCH that leaves capacity out keeps
    // whatever cap the event already had, so clearing the field would not clear
    // the cap.
    expect(payload.capacity).toBeNull();
    expect(eventSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a capacity of zero rather than storing an event nobody can join", () => {
    const payload = toEventPayload({ ...EMPTY_EVENT_FORM, title: "A", venue_name: "V", capacity: "0" });

    expect(eventSchema.safeParse(payload).success).toBe(false);
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

describe("stepPrice", () => {
  it("moves by the amount asked for", () => {
    expect(stepPrice("0", PRICE_STEP)).toBe("100");
    expect(stepPrice("250", PRICE_STEP)).toBe("350");
    expect(stepPrice("250", -PRICE_STEP)).toBe("150");
  });

  it("clamps at zero rather than going negative", () => {
    // A negative price is refused by eventSchema and by chk_event_price_nonneg,
    // so the control must not be able to produce one.
    expect(stepPrice("50", -PRICE_STEP)).toBe("0");
    expect(stepPrice("0", -PRICE_STEP)).toBe("0");
  });

  it("treats a blank box as zero rather than NaN", () => {
    expect(stepPrice("", PRICE_STEP)).toBe("100");
    expect(stepPrice("   ", -PRICE_STEP)).toBe("0");
  });

  it("falls back to zero for a value that is not a number at all", () => {
    // A number input keeps this out, but the form is seeded from a stored row
    // through toFormValues, and the guard is worthless if nothing proves it
    // catches a NaN rather than propagating one into the payload.
    expect(stepPrice("abc", PRICE_STEP)).toBe("100");
    expect(stepPrice("abc", -PRICE_STEP)).toBe("0");
  });

  it("keeps the two decimals the column stores, without float dust", () => {
    expect(stepPrice("1500.50", PRICE_STEP)).toBe("1600.5");
    expect(stepPrice("0.1", PRICE_STEP)).toBe("100.1");
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
      capacity: 150,
    });

    expect(values).toEqual({
      title: "Alpha",
      event_type: "onsite",
      event_date: "2026-09-01",
      // Trimmed from the "09:00:00" a `time` column returns, so a form seeded
      // from a stored row equals the same form after a browser round-trip.
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Hall A",
      venue_address: "123 Main St",
      meeting_url: "",
      description: "All about AI",
      price: "1500.5",
      currency: "PHP",
      capacity: "150",
      facilitator_ids: [],
      speaker_profile_ids: [],
    });
  });

  it("seeds the selected facilitator ids from the stored event", () => {
    const values = toFormValues({ title: "Alpha", facilitator_ids: [3, 9] });

    expect(values.facilitator_ids).toEqual([3, 9]);
  });

  it("renders nullable columns as empty inputs rather than the string 'null'", () => {
    const values = toFormValues({ title: "Alpha", venue_address: null, description: null, price: 0, capacity: null });

    expect(values.venue_address).toBe("");
    expect(values.description).toBe("");
    expect(values.price).toBe("0");
    expect(values.capacity).toBe("");
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
      /^Capacity/,
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByText(/Facilitators/)).toBeTruthy();
    expect(screen.getByText(/Speakers/)).toBeTruthy();
  });

  it("carries a typed capacity through to the submitted payload", async () => {
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "^Capacity": "40" });
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ capacity: 40 });
  });

  it("leaves an untouched capacity uncapped", async () => {
    const onSubmit = renderForm();

    fill(REQUIRED);
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ capacity: null });
  });

  it("steps the price by 100 a press, in both directions", async () => {
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "^Price$": "250" });
    fireEvent.click(screen.getByRole("button", { name: /increase price by 100/i }));
    fireEvent.click(screen.getByRole("button", { name: /increase price by 100/i }));
    fireEvent.click(screen.getByRole("button", { name: /decrease price by 100/i }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ price: 350 });
  });

  it("puts both price steppers after the box, so they sit to its right", () => {
    renderForm();

    const price = screen.getByLabelText(/^Price$/);
    const minus = screen.getByRole("button", { name: /decrease price by 100/i });
    const plus = screen.getByRole("button", { name: /increase price by 100/i });

    // Document order is what the flex row renders left to right.
    expect(price.compareDocumentPosition(minus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(minus.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("never steps the price below zero", async () => {
    const onSubmit = renderForm();

    fill(REQUIRED);
    fireEvent.click(screen.getByRole("button", { name: /decrease price by 100/i }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ price: 0 });
  });

  it("still accepts a typed price the stepper would never land on", async () => {
    // The input declares step="any" precisely so this submits: a step of 100
    // would make the browser reject it as a step mismatch.
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "^Price$": "1500.50" });
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ price: 1500.5 });
  });

  it("takes the venue address away once the event is online, and drops what it held", async () => {
    const onSubmit = renderForm();

    fill({ ...REQUIRED, "Venue address": "123 Rizal St" });
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));

    expect(screen.queryByLabelText(/Venue address/)).toBeNull();

    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Not merely absent from the UI: the address must not reach the payload,
    // or it rides along into the ticket and the calendar invite.
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ event_type: "online", venue_address: null });
  });

  it("swaps the address box for a meeting link box when the event is online", () => {
    renderForm();

    expect(screen.getByLabelText(/Venue address/)).toBeTruthy();
    expect(screen.queryByLabelText(/Meeting link/)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /online/i }));

    // Swapped rather than shown side by side, so there is never a dead address
    // box next to a live link box.
    expect(screen.getByLabelText(/Meeting link/)).toBeTruthy();
    expect(screen.queryByLabelText(/Venue address/)).toBeNull();
  });

  it("creates an online event with no meeting link, which is the normal case", async () => {
    const onSubmit = renderForm();

    fill(REQUIRED);
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ event_type: "online", meeting_url: null });
  });

  it("sends a meeting link typed at creation", async () => {
    const onSubmit = renderForm();

    fill(REQUIRED);
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));
    fill({ "Meeting link": "https://meet.google.com/abc-defg-hij" });
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ meeting_url: "https://meet.google.com/abc-defg-hij" });
  });

  it("drops a meeting link when the event goes back to onsite", async () => {
    const onSubmit = renderForm();

    fill(REQUIRED);
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));
    fill({ "Meeting link": "https://meet.google.com/abc-defg-hij" });
    fireEvent.click(screen.getByRole("radio", { name: /onsite/i }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Otherwise a working URL stays on a row nothing renders it from.
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ event_type: "onsite", meeting_url: null });
  });

  it("offers the meeting link only while the event is being created", () => {
    // At creation there is no row to hang a panel off, the same reason the
    // cover and the team are edited here and nowhere else.
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));

    expect(screen.getByLabelText(/Meeting link/)).toBeTruthy();
  });

  it("hands the link to the Overview panel once the event exists", () => {
    render(
      <EventForm
        mode="edit"
        submitLabel="Save"
        submittingLabel="Saving..."
        initialValues={{ ...EMPTY_EVENT_FORM, event_type: "online", venue_name: "Zoom" }}
        onSubmit={vi.fn()}
      />,
    );

    // One surface per context: an admin editing the event must not find a
    // second box writing the column the Overview panel already owns.
    expect(screen.queryByLabelText(/Meeting link/)).toBeNull();
    expect(screen.getByText(/Set on the Overview tab/i)).toBeTruthy();
  });

  it("calls the venue field a platform when the event is online", () => {
    renderForm();

    expect(screen.getByLabelText(/^Venue$/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));

    expect(screen.getByLabelText(/^Platform$/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Venue$/)).toBeNull();
  });

  it("gives the address back when the event returns to onsite", () => {
    renderForm();

    fill({ ...REQUIRED, "Venue address": "123 Rizal St" });
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));
    fireEvent.click(screen.getByRole("radio", { name: /onsite/i }));

    const address = screen.getByLabelText(/Venue address/) as HTMLInputElement;
    expect(address.disabled).toBe(false);
    // The value was disabled, never discarded, so switching back does not cost
    // the admin the address they had already typed.
    expect(address.value).toBe("123 Rizal St");
  });

  it("creates an onsite event unless told otherwise", async () => {
    const onSubmit = renderForm();

    fill(REQUIRED);
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ event_type: "onsite" });
  });

  it("never flips an input between uncontrolled and controlled", () => {
    // The fields here are conditional, and a value that starts undefined mounts
    // its input uncontrolled — React only complains later, when a real value
    // arrives. Watching console.error is the only way this surfaces in a test.
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args.join(" ")));

    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));
    fireEvent.change(screen.getByLabelText(/Meeting link/), { target: { value: "https://meet.google.com/abc" } });
    fireEvent.click(screen.getByRole("radio", { name: /onsite/i }));
    fireEvent.change(screen.getByLabelText(/Venue address/), { target: { value: "123 Rizal St" } });

    expect(errors.join("\n")).toBe("");
    spy.mockRestore();
  });

  it("seeds every field even when handed values that predate a column", () => {
    // An caller holding an older shape — a stale module in dev, or a partial
    // object cast into place — must not leave an input uncontrolled.
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args.join(" ")));

    const stale = { ...EMPTY_EVENT_FORM } as Record<string, unknown>;
    delete stale.meeting_url;
    delete stale.capacity;

    // Create mode, because that is where both of the deleted keys have an
    // input to be uncontrolled in.
    render(
      <EventForm
        mode="create"
        submitLabel="Create"
        submittingLabel="Creating..."
        initialValues={stale as unknown as EventFormValues}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /online/i }));

    expect((screen.getByLabelText(/Meeting link/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Capacity/) as HTMLInputElement).value).toBe("");
    expect(errors.join("\n")).toBe("");
    spy.mockRestore();
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
