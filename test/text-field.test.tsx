// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TextField } from "@/shared/components/text-field";

afterEach(cleanup);

describe("TextField", () => {
  it("labels the control it renders", () => {
    render(<TextField id="city" label="City" value="Cebu" onChange={vi.fn()} />);

    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("Cebu");
  });

  // Every call site unwrapped `e.target.value` itself, fourteen times over.
  it("hands the caller the value rather than the event", () => {
    const onChange = vi.fn();
    render(<TextField id="city" label="City" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Manila" } });

    expect(onChange).toHaveBeenCalledWith("Manila");
  });

  it("marks nothing invalid and describes nothing while the field is accepted", () => {
    render(<TextField id="city" label="City" value="" onChange={vi.fn()} />);

    const field = screen.getByLabelText("City");
    expect(field.getAttribute("aria-invalid")).toBe("false");
    expect(field.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // The ids are derived from one prop, so a field cannot be described by a
  // message that is not on the page — which is what spelling them out by hand
  // at every call site risked.
  it("ties the message to the field that was rejected", () => {
    render(<TextField id="city" label="City" value="" onChange={vi.fn()} error="Required." />);

    const field = screen.getByLabelText("City");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(field.getAttribute("aria-describedby")!)!.textContent).toBe("Required.");
    expect(screen.getByRole("alert").textContent).toBe("Required.");
  });

  it("describes a field by its hint and its error together", () => {
    render(<TextField id="city" label="City" value="" onChange={vi.fn()} hint="Where you live." error="Required." />);

    const described = screen
      .getByLabelText("City")
      .getAttribute("aria-describedby")!
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);

    expect(described).toEqual(["Required.", "Where you live."]);
  });

  it("renders without a label when the card's heading is the label", () => {
    render(<TextField id="city" value="" onChange={vi.fn()} />);

    expect(document.querySelector("label")).toBeNull();
    expect(document.getElementById("city")).toBeTruthy();
  });

  // The one field that is a textarea must not lose the wiring by opting out
  // of the default control.
  it("gives a replacement control the same wiring", () => {
    const onChange = vi.fn();
    render(
      <TextField
        id="bio"
        label="Bio"
        value="Hello"
        onChange={onChange}
        error="Too short."
        render={(control) => <textarea {...control} />}
      />,
    );

    const field = screen.getByLabelText("Bio");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(field.getAttribute("aria-describedby")!)!.textContent).toBe("Too short.");

    fireEvent.change(field, { target: { value: "Longer" } });
    expect(onChange).toHaveBeenCalledWith("Longer");
  });
});
