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
    emailSent,
    saving: false,
    onSubmit: vi.fn(),
    resendIn: 0,
    onResend: vi.fn(),
    onUseDifferent: vi.fn(),
    ...overrides,
  };
  render(<EmailSection {...props} />);
  return props;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Change email" }) as HTMLButtonElement;
}

afterEach(cleanup);

describe("EmailSection", () => {
  it("blocks submitting the address the account already has, and says why", () => {
    renderSection("ada@example.com");

    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText("This is already your email address.")).toBeTruthy();
  });

  it("blocks it however it is capitalised or padded", () => {
    for (const typed of ["ADA@EXAMPLE.COM", "  Ada@Example.com  "]) {
      renderSection(typed);
      expect(submitButton().disabled).toBe(true);
      cleanup();
    }
  });

  it("points a screen reader at the reason rather than only colouring it", () => {
    renderSection("ada@example.com");

    const input = screen.getByPlaceholderText("new@example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-unchanged");
    expect(document.getElementById("email-unchanged")).toBeTruthy();
  });

  it("allows a genuinely different address and shows no complaint", () => {
    renderSection("grace@example.com");

    expect(submitButton().disabled).toBe(false);
    expect(screen.queryByText("This is already your email address.")).toBeNull();
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

  it("leaves submitting available, since an odd domain may still be real", () => {
    renderSection("ada@gmoil.com");

    expect(submitButton().disabled).toBe(false);
  });

  it("says nothing about a domain that is not a near-miss", () => {
    renderSection("ada@startuplab.io");

    expect(screen.queryByText(/Did you mean/)).toBeNull();
  });

  it("still blocks an empty field", () => {
    renderSection("");

    expect(submitButton().disabled).toBe(true);
    expect(screen.queryByText("This is already your email address.")).toBeNull();
  });

  it("shows the verification notice instead of the form once sent", () => {
    renderSection("grace@example.com", true);

    expect(screen.queryByRole("button", { name: "Change email" })).toBeNull();
    expect(screen.getByText(/Check your inbox/)).toBeTruthy();
  });
});

describe("EmailSection after the link is sent", () => {
  it("offers a way to send it again and a way back to the field", () => {
    renderSection("grace@example.com", true);

    expect(screen.getByRole("button", { name: "Send it again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use a different address" })).toBeTruthy();
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

  it("returns to the field when the address was wrong", () => {
    const { onUseDifferent } = renderSection("grace@example.com", true);

    fireEvent.click(screen.getByRole("button", { name: "Use a different address" }));

    expect(onUseDifferent).toHaveBeenCalled();
  });

  // The link silently going nowhere is the whole failure mode, so the copy has
  // to point at the place people actually look next.
  it("mentions the spam folder", () => {
    renderSection("grace@example.com", true);

    expect(screen.getByText(/spam folder/)).toBeTruthy();
  });
});
