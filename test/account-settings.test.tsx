// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  useAccountSettings: vi.fn(),
  useSpeakerProfile: vi.fn(),
}));

vi.mock("@/modules/user/lib/use-account-settings", () => ({ useAccountSettings: hooks.useAccountSettings }));
vi.mock("@/modules/user/lib/use-speaker-profile", () => ({ useSpeakerProfile: hooks.useSpeakerProfile }));

import { AccountSettings } from "@/modules/user/components/account-settings";

function settings(overrides: Record<string, unknown> = {}) {
  return {
    toast: null,
    dismissToast: vi.fn(),
    notify: vi.fn(),
    currentUser: { id: 1, role: "speaker", full_name: "Ada", email: "ada@example.com", profile_image_url: null },
    name: "Ada",
    setName: vi.fn(),
    savingName: false,
    saveName: vi.fn(),
    newEmail: "",
    setNewEmail: vi.fn(),
    emailSent: false,
    savingEmail: false,
    changeEmail: vi.fn(),
    currentPassword: "",
    setCurrentPassword: vi.fn(),
    newPassword: "",
    setNewPassword: vi.fn(),
    savingPassword: false,
    changePassword: vi.fn(),
    uploading: false,
    changeProfilePhoto: vi.fn(),
    ...overrides,
  };
}

function speaker(overrides: Record<string, unknown> = {}) {
  return {
    isSpeaker: true,
    speakerProfileId: 5,
    designation: "CTO",
    setDesignation: vi.fn(),
    bio: "Leads.",
    setBio: vi.fn(),
    savingSpeaker: false,
    saveSpeakerProfile: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AccountSettings", () => {
  it("renders the core account sections for any signed-in user", () => {
    hooks.useAccountSettings.mockReturnValue(settings());
    hooks.useSpeakerProfile.mockReturnValue(speaker({ isSpeaker: false }));

    render(<AccountSettings />);

    expect(screen.getByRole("heading", { name: "Account Settings" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Profile Photo" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Profile Name" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Email" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Password" })).toBeTruthy();
    expect(screen.queryByText("Professional Info")).toBeNull();
  });

  it("shows the speaker section only for a speaker and wires its form to saveSpeakerProfile", () => {
    const saveSpeakerProfile = vi.fn();
    hooks.useAccountSettings.mockReturnValue(settings());
    hooks.useSpeakerProfile.mockReturnValue(speaker({ saveSpeakerProfile }));

    render(<AccountSettings />);

    const form = screen.getByPlaceholderText("e.g. Senior Developer").closest("form")!;
    fireEvent.submit(form);

    expect(saveSpeakerProfile).toHaveBeenCalledTimes(1);
  });

  it("shows a loading placeholder until the speaker profile resolves", () => {
    hooks.useAccountSettings.mockReturnValue(settings());
    hooks.useSpeakerProfile.mockReturnValue(speaker({ speakerProfileId: undefined }));

    render(<AccountSettings />);

    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders the uploaded photo as the preview", () => {
    hooks.useAccountSettings.mockReturnValue(
      settings({
        currentUser: {
          id: 1,
          role: "speaker",
          full_name: "Ada",
          email: "ada@example.com",
          profile_image_url: "https://cdn.example/a.jpg",
        },
      }),
    );
    hooks.useSpeakerProfile.mockReturnValue(speaker({ isSpeaker: false }));

    const { container } = render(<AccountSettings />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/a.jpg");
  });

  it("shows the email-verification notice once the change is sent", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ emailSent: true, newEmail: "new@example.com" }));
    hooks.useSpeakerProfile.mockReturnValue(speaker({ isSpeaker: false }));

    render(<AccountSettings />);

    expect(screen.getByText(/Verification link sent to/)).toBeTruthy();
  });

  it("renders a toast and calls dismissToast once it closes", () => {
    vi.useFakeTimers();
    const dismissToast = vi.fn();
    hooks.useAccountSettings.mockReturnValue(
      settings({ toast: { title: "Saved", description: "Professional info updated.", type: "success" }, dismissToast }),
    );
    hooks.useSpeakerProfile.mockReturnValue(speaker({ isSpeaker: false }));

    render(<AccountSettings />);

    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    expect(dismissToast).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
