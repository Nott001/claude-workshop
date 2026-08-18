// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { PasswordSection } from "@/modules/user/components/password-section";

type PasswordState = React.ComponentProps<typeof PasswordSection>["password"];

// The card takes one object off the hook rather than six loose props.
function renderSection(overrides: Partial<PasswordState> = {}) {
  const password: PasswordState = {
    current: "whatever",
    setCurrent: vi.fn(),
    currentError: null,
    next: "the quiet kettle sings",
    setNext: vi.fn(),
    nextError: null,
    dirty: true,
    saving: false,
    saved: false,
    save: vi.fn(),
    ...overrides,
  };
  return render(<PasswordSection password={password} />);
}

describe("PasswordSection field errors", () => {
  afterEach(cleanup);

  it("offers the reset flow from the password heading", () => {
    renderSection();

    const link = screen.getByRole("link", { name: "Forgot password?" });
    expect(link.getAttribute("href")).toBe("/forgot-password");
  });

  it("renders no message and marks nothing invalid while both fields are accepted", () => {
    renderSection();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Current password").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("false");
  });

  it("announces a rejected current password and ties the message to that field", () => {
    renderSection({ currentError: "That is not your current password." });

    const field = screen.getByLabelText("Current password");
    const message = screen.getByRole("alert");

    expect(message.textContent).toBe("That is not your current password.");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    // The description link is what lets a screen reader read the two together.
    expect(field.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("leaves the new password field untouched when only the current one was wrong", () => {
    renderSection({ currentError: "That is not your current password." });

    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("false");
  });

  it("announces a rejected new password against its own field", () => {
    renderSection({ nextError: "At least 12 characters" });

    const field = screen.getByLabelText("New password");
    const message = screen.getByRole("alert");

    expect(message.textContent).toBe("At least 12 characters");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByLabelText("Current password").getAttribute("aria-invalid")).toBe("false");
  });

  it("shows each message against its own field when both are rejected", () => {
    renderSection({
      currentError: "That is not your current password.",
      nextError: "At least 12 characters",
    });

    const messages = screen.getAllByRole("alert");
    expect(messages).toHaveLength(2);
    expect(screen.getByLabelText("Current password").getAttribute("aria-describedby")).toBe(messages[0].id);
    expect(screen.getByLabelText("New password").getAttribute("aria-describedby")).toBe(messages[1].id);
  });
});
