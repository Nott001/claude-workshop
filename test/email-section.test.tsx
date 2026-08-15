// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EmailSection } from "@/modules/user/components/email-section";

type Props = React.ComponentProps<typeof EmailSection>;

function renderSection(newEmail: string, emailSent = false, overrides: Partial<Props> = {}) {
  const props: Props = {
    currentEmail: "ada@example.com",
    newEmail,
    onChange: vi.fn(),
    emailError: null,
    emailSent,
    saving: false,
    resendIn: 0,
    onResend: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<EmailSection {...props} />);
  return props;
}

afterEach(cleanup);

describe("EmailSection", () => {
  it("shows why the account's own address was refused", () => {
    renderSection("ada@example.com", false, { emailError: "This is already your email address." });

    expect(screen.getByText("This is already your email address.")).toBeTruthy();
  });

  it("shows it however it is capitalised or padded", () => {
    for (const typed of ["ADA@EXAMPLE.COM", "  Ada@Example.com  "]) {
      renderSection(typed, false, { emailError: "This is already your email address." });
      expect(screen.getByText("This is already your email address.")).toBeTruthy();
      cleanup();
    }
  });

  it("points a screen reader at the reason rather than only colouring it", () => {
    renderSection("ada@example.com", false, { emailError: "This is already your email address." });

    const input = screen.getByPlaceholderText("you@example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-error");
    expect(document.getElementById("email-error")).toBeTruthy();
  });

  it("shows no complaint for a genuinely different address", () => {
    renderSection("grace@example.com");

    expect(screen.queryByText("This is already your email address.")).toBeNull();
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("aria-invalid")).toBe("false");
  });

  // The case that slipped through: gmoil.com is registered, answers DNS and
  // accepts mail, so a check that only asks "does this domain exist" is silent
  // on it. The warning has to come from how the address looks.
  it("suggests the likely domain even though the typo resolves perfectly well", () => {
    renderSection("ada@gmoil.com");

    expect(screen.getByRole("button", { name: "ada@gmail.com" })).toBeTruthy();
  });

  it("fills the field with the suggestion when it is taken up", () => {
    const { onChange } = renderSection("ada@gmial.com");

    fireEvent.click(screen.getByRole("button", { name: "ada@gmail.com" }));

    expect(onChange).toHaveBeenCalledWith("ada@gmail.com");
  });

  it("keeps the suggestion visible when the field carries no rejection", () => {
    renderSection("ada@gmoil.com");

    expect(screen.getByRole("button", { name: "ada@gmail.com" })).toBeTruthy();
    expect(screen.queryByText("This is already your email address.")).toBeNull();
  });

  it("says nothing about a domain that is not a near-miss", () => {
    renderSection("ada@startuplab.io");

    expect(screen.queryByText(/Did you mean/)).toBeNull();
  });

  it("leaves an empty field free of complaints, since Save Changes is gated on dirty", () => {
    renderSection("");

    expect(screen.queryByText("This is already your email address.")).toBeNull();
  });

  it("forwards what is typed into the input", () => {
    const { onChange } = renderSection("ada@example.com");

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "ada+events@example.com" },
    });

    expect(onChange).toHaveBeenCalledWith("ada+events@example.com");
  });

  it("shows the pending status instead of the form once sent", () => {
    renderSection("grace@example.com", true);

    expect(screen.getByText("Email change pending")).toBeTruthy();
  });
});

describe("EmailSection after the link is sent", () => {
  it("offers a way to send it again and a way out to the field", () => {
    renderSection("grace@example.com", true);

    expect(screen.getByRole("button", { name: "Send it again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("names the wait instead of letting a press fail against the rate limit", () => {
    renderSection("grace@example.com", true, { resendIn: 42 });

    const again = screen.getByRole("button", { name: "Send again in 42s" }) as HTMLButtonElement;
    expect(again.disabled).toBe(true);
  });

  it("sends again when asked", () => {
    const { onResend } = renderSection("grace@example.com", true);

    fireEvent.click(screen.getByRole("button", { name: "Send it again" }));

    expect(onResend).toHaveBeenCalled();
  });

  it("dismisses the pending status when cancelled", () => {
    const { onCancel } = renderSection("grace@example.com", true);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });

  // A pending change outlives the dismiss — the sheet-12 gate FAILed, so there
  // is no server-side cancel to void it. The copy has to say the change lasts
  // until the link expires rather than pretending a dismiss removed it.
  it("says the change expires on its own rather than that it was undone", () => {
    renderSection("grace@example.com", true);

    expect(screen.getByText("Email change pending")).toBeTruthy();
    expect(screen.getByText(/expires on its own/)).toBeTruthy();
    expect(screen.queryByText("Use a different address")).toBeNull();
  });
});
