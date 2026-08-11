// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EmailSection } from "@/modules/user/components/email-section";

function renderSection(newEmail: string, emailSent = false) {
  render(
    <EmailSection
      currentEmail="ada@example.com"
      newEmail={newEmail}
      onChange={vi.fn()}
      emailSent={emailSent}
      saving={false}
      onSubmit={vi.fn()}
    />,
  );
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
    const onChange = vi.fn();
    render(
      <EmailSection
        currentEmail="ada@example.com"
        newEmail="ada@gmial.com"
        onChange={onChange}
        emailSent={false}
        saving={false}
        onSubmit={vi.fn()}
      />,
    );

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
