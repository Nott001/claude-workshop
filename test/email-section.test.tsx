// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EmailSection } from "@/modules/user/components/email-section";
import { EMAIL_CHANGE_LINK_TTL_LABEL } from "@/shared/lib/email";

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
  // The pending branch renders no field, so copy pointing at one sent people
  // looking for an input that is not there. Cancel is what brings it back.
  it("does not tell a pending change to type into a field it has removed", () => {
    renderSection("new@example.com", true);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByText(new RegExp(`valid for ${EMAIL_CHANGE_LINK_TTL_LABEL}.*cancel this change first`))).toBeTruthy();
    expect(screen.queryByText(/type it below/)).toBeNull();
  });

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

  it("announces a just-verified address above the box", () => {
    renderSection("grace@example.com", false, { emailVerified: "grace@example.com" });

    expect(screen.getByText("Email verified — grace@example.com")).toBeTruthy();
  });

  it("does not announce a verification that has not happened", () => {
    renderSection("grace@example.com");

    expect(screen.queryByText(/Email verified/)).toBeNull();
  });

  it("dismisses the verification notice when asked", () => {
    const { onDismissVerified } = renderSection("grace@example.com", false, {
      emailVerified: "grace@example.com",
      onDismissVerified: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismissVerified).toHaveBeenCalled();
  });

  it("keeps the verification notice out of the pending view", () => {
    renderSection("grace@example.com", true, { emailVerified: "grace@example.com" });

    expect(screen.queryByText(/Email verified/)).toBeNull();
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

    const again = screen.getByRole("button", { name: `Resend available in 42s` }) as HTMLButtonElement;
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

  // The banner text is about a pending link's lifetime, not about a dismiss
  // undoing it: while a change is pending its link is valid for the full 24h,
  // and cancel voids it server-side (sheets 01/02).
  it("says the link is valid for its full lifetime rather than that it was undone", () => {
    renderSection("grace@example.com", true);

    expect(screen.getByText("Email change pending")).toBeTruthy();
    expect(screen.getByText(new RegExp(`The link is valid for ${EMAIL_CHANGE_LINK_TTL_LABEL}`))).toBeTruthy();
    expect(screen.queryByText("Use a different address")).toBeNull();
  });
});
