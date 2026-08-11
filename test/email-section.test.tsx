// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
