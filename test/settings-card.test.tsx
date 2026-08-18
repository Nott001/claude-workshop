// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SettingsCard } from "@/modules/user/components/settings-card";

afterEach(cleanup);

describe("SettingsCard", () => {
  it("anchors itself under the id the nav jumps to", () => {
    render(
      <SettingsCard id="profile" icon="person" title="Profile">
        <p>body</p>
      </SettingsCard>,
    );

    expect(document.querySelector("section#profile")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "PROFILE" })).toBeTruthy();
  });

  // A card whose controls each act on their own — the delete dialog — must not
  // grow a submit button that looks like the saves above it.
  it("renders no form and no button without a footer", () => {
    const { container } = render(
      <SettingsCard id="danger" icon="person" title="Delete Account">
        <p>body</p>
      </SettingsCard>,
    );

    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("submits through its own form, so Enter saves the section the cursor is in", () => {
    const onSave = vi.fn();
    const { container } = render(
      <SettingsCard id="profile" icon="person" title="Profile" footer={{ onSave, label: "Save profile", dirty: true }}>
        <input aria-label="Name" />
      </SettingsCard>,
    );

    fireEvent.submit(container.querySelector("form")!);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("holds the button down while the card is clean", () => {
    render(
      <SettingsCard
        id="profile"
        icon="person"
        title="Profile"
        footer={{ onSave: vi.fn(), label: "Save profile", dirty: false }}
      >
        <p>body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole("button", { name: "Save profile" }).hasAttribute("disabled")).toBe(true);
  });

  it("falls back to a generic in-flight label when the card names none", () => {
    render(
      <SettingsCard
        id="profile"
        icon="person"
        title="Profile"
        footer={{ onSave: vi.fn(), label: "Save profile", dirty: true, saving: true }}
      >
        <p>body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy();
  });

  it("prefers the card's own in-flight label when it has one", () => {
    render(
      <SettingsCard
        id="email"
        icon="person"
        title="Email"
        footer={{ onSave: vi.fn(), label: "Send verification link", savingLabel: "Sending…", dirty: true, saving: true }}
      >
        <p>body</p>
      </SettingsCard>,
    );

    expect(screen.getByRole("button", { name: "Sending…" })).toBeTruthy();
  });

  it("shows the description, the aside and the footer note when given them", () => {
    render(
      <SettingsCard
        id="password"
        icon="person"
        title="Password"
        description="Signs you out elsewhere."
        aside={<a href="/forgot-password">Forgot password?</a>}
        footer={{ onSave: vi.fn(), label: "Update password", dirty: true, note: "Takes effect immediately." }}
      >
        <p>body</p>
      </SettingsCard>,
    );

    expect(screen.getByText("Signs you out elsewhere.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
    expect(screen.getByText("Takes effect immediately.")).toBeTruthy();
  });

  it("confirms in its own footer once its save has landed", () => {
    render(
      <SettingsCard
        id="profile"
        icon="person"
        title="Profile"
        footer={{ onSave: vi.fn(), label: "Save profile", saved: "Profile saved" }}
      >
        <p>body</p>
      </SettingsCard>,
    );

    expect(screen.getByText("Profile saved")).toBeTruthy();
  });

  // A footer that only reports, with nothing to press.
  it("renders a footer with no button when the card has no save", () => {
    render(
      <SettingsCard id="profile" icon="person" title="Profile" footer={{ label: "unused", note: "Read only." }}>
        <p>body</p>
      </SettingsCard>,
    );

    expect(screen.getByText("Read only.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
