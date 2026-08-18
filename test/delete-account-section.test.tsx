// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  useDeleteAccount: vi.fn(),
}));

vi.mock("@/modules/user/lib/use-delete-account", () => ({ useDeleteAccount: hooks.useDeleteAccount }));

import { DeleteAccountSection } from "@/modules/user/components/delete-account-section";

function value(overrides: Record<string, unknown> = {}) {
  return {
    open: false,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    phrase: "",
    setPhrase: vi.fn(),
    canConfirm: false,
    submitting: false,
    error: null,
    confirm: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("DeleteAccountSection", () => {
  it("renders the delete-account section heading and trigger", () => {
    hooks.useDeleteAccount.mockReturnValue(value());

    render(<DeleteAccountSection />);

    expect(screen.getByRole("heading", { name: "DELETE ACCOUNT" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeTruthy();
  });

  it("opens the dialog through the hook when the trigger is used", () => {
    const openDialog = vi.fn();
    hooks.useDeleteAccount.mockReturnValue(value({ openDialog }));

    render(<DeleteAccountSection />);

    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(openDialog).toHaveBeenCalledTimes(1);
  });

  it("shows the permanent-deletion message and typed-phrase input once open", () => {
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, phrase: "Delete My Account" }));

    render(<DeleteAccountSection />);

    expect(
      screen.getByText("Deleting your account permanently removes your personal data. This cannot be undone."),
    ).toBeTruthy();
    const input = screen.getByLabelText('Type "Delete My Account" to confirm') as HTMLInputElement;
    expect(input.value).toBe("Delete My Account");
  });

  it("routes keystrokes in the phrase input to the hook's setPhrase", () => {
    const setPhrase = vi.fn();
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, setPhrase }));

    render(<DeleteAccountSection />);

    fireEvent.change(screen.getByLabelText('Type "Delete My Account" to confirm'), {
      target: { value: "Delete My Account" },
    });
    expect(setPhrase).toHaveBeenCalledWith("Delete My Account");
  });

  it("disables the confirm button until the hook allows it", () => {
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, canConfirm: false }));

    render(<DeleteAccountSection />);

    const confirm = screen.getByRole("button", { name: "Delete Account" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    hooks.useDeleteAccount.mockReturnValue(value({ open: true, canConfirm: true }));
    render(<DeleteAccountSection />);

    expect((screen.getByRole("button", { name: "Delete Account" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the submitting label and disables the confirm while submitting", () => {
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, canConfirm: true, submitting: true }));

    render(<DeleteAccountSection />);

    const confirm = screen.getByRole("button", { name: "Deleting…" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("invokes the hook's confirm from the enabled Delete Account button", () => {
    const confirm = vi.fn();
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, canConfirm: true, confirm }));

    render(<DeleteAccountSection />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("closes through the hook when Cancel is used", () => {
    const closeDialog = vi.fn();
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, closeDialog }));

    render(<DeleteAccountSection />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(closeDialog).toHaveBeenCalledTimes(1);
  });

  it("marks the input invalid and renders the inline error when the hook sets one", () => {
    hooks.useDeleteAccount.mockReturnValue(value({ open: true, error: "We could not delete your account. Please try again." }));

    render(<DeleteAccountSection />);

    const input = screen.getByLabelText('Type "Delete My Account" to confirm');
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("delete-account-phrase-error");
    expect(screen.getByRole("alert").textContent).toBe("We could not delete your account. Please try again.");
  });
});
