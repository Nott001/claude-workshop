// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  useAccountSettings: vi.fn(),
}));

vi.mock("@/modules/user/lib/use-account-settings", () => ({ useAccountSettings: hooks.useAccountSettings }));

import { AccountSettings } from "@/modules/user/components/account-settings";

function settings(overrides: Record<string, unknown> = {}) {
  return {
    toast: null,
    dismissToast: vi.fn(),
    notify: vi.fn(),
    currentUser: { id: 1, role: ROLES.SPEAKER, full_name: "Ada", email: "ada@example.com", profile_image_url: null },
    name: "Ada",
    setName: vi.fn(),
    nameError: null,
    newEmail: "",
    setNewEmail: vi.fn(),
    emailError: null,
    emailSent: false,
    savingEmail: false,
    resendIn: 0,
    resendVerification: vi.fn(),
    useDifferentEmail: vi.fn(),
    currentPassword: "",
    setCurrentPassword: vi.fn(),
    currentPasswordError: null,
    newPassword: "",
    setNewPassword: vi.fn(),
    newPasswordError: null,
    dirty: false,
    saving: false,
    saveChanges: vi.fn(),
    uploading: false,
    changeProfilePhoto: vi.fn(),
    deleting: false,
    deleteProfilePhoto: vi.fn(),
    isSpeaker: true,
    speakerProfileId: 5,
    designation: "CTO",
    setDesignation: vi.fn(),
    bio: "Leads.",
    setBio: vi.fn(),
    linkedinUrl: "https://linkedin.com/in/ada",
    setLinkedinUrl: vi.fn(),
    twitterUrl: "",
    setTwitterUrl: vi.fn(),
    githubUrl: "https://github.com/ada",
    setGithubUrl: vi.fn(),
    websiteUrl: "",
    setWebsiteUrl: vi.fn(),
    speakerFieldErrors: {},
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
    hooks.useAccountSettings.mockReturnValue(settings({ isSpeaker: false }));

    render(<AccountSettings />);

    expect(screen.getByRole("heading", { name: "Account Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Profile photo" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Profile Name" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Email" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Password" })).toBeTruthy();
    expect(screen.queryByText("Professional Info")).toBeNull();
  });

  it("owns a single Save Changes button and submits the one form through saveChanges", () => {
    const saveChanges = vi.fn((e: React.FormEvent) => e.preventDefault());
    hooks.useAccountSettings.mockReturnValue(settings({ saveChanges, dirty: true }));

    const { container } = render(<AccountSettings />);

    const form = container.querySelector("form")!;
    expect(screen.getAllByRole("button", { name: "Save Changes" })).toHaveLength(1);
    fireEvent.submit(form);
    expect(saveChanges).toHaveBeenCalledTimes(1);
  });

  it("disables Save Changes while nothing is dirty", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ dirty: false }));

    render(<AccountSettings />);

    const save = screen.getByRole("button", { name: "Save Changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("enables Save Changes once something is dirty, and shows the saving label while saving", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ dirty: true }));

    const { rerender } = render(<AccountSettings />);

    const save = screen.getByRole("button", { name: "Save Changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    hooks.useAccountSettings.mockReturnValue(settings({ dirty: true, saving: true }));
    rerender(<AccountSettings />);

    expect(screen.getByRole("button", { name: "Saving\u2026" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Saving\u2026" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the speaker block inside the same form only for a speaker", () => {
    hooks.useAccountSettings.mockReturnValue(settings());

    const { container } = render(<AccountSettings />);

    expect(screen.getByText("Professional Info")).toBeTruthy();
    // One form carries every section, the speaker block included.
    expect(container.querySelectorAll("form")).toHaveLength(1);
    const speakerHeading = screen.getByRole("heading", { name: "Professional Info" });
    expect(speakerHeading.closest("form")).not.toBeNull();
  });

  it("renders the speaker link inputs with their values and handlers", () => {
    const setLinkedinUrl = vi.fn();
    const setGithubUrl = vi.fn();
    hooks.useAccountSettings.mockReturnValue(
      settings({
        linkedinUrl: "https://linkedin.com/in/ada",
        setLinkedinUrl,
        githubUrl: "https://github.com/ada",
        setGithubUrl,
      }),
    );

    render(<AccountSettings />);

    const linkedin = screen.getByLabelText("LinkedIn") as HTMLInputElement;
    const twitter = screen.getByLabelText("X (Twitter)") as HTMLInputElement;
    const github = screen.getByLabelText("GitHub") as HTMLInputElement;
    const website = screen.getByLabelText("Website") as HTMLInputElement;

    expect(linkedin.value).toBe("https://linkedin.com/in/ada");
    expect(twitter.value).toBe("");
    expect(github.value).toBe("https://github.com/ada");
    expect(website.value).toBe("");

    fireEvent.change(linkedin, { target: { value: "https://linkedin.com/in/ada2" } });
    fireEvent.change(github, { target: { value: "https://github.com/ada2" } });
    expect(setLinkedinUrl).toHaveBeenCalledWith("https://linkedin.com/in/ada2");
    expect(setGithubUrl).toHaveBeenCalledWith("https://github.com/ada2");
  });

  it("shows a speaker URL rejection on the owning input", () => {
    hooks.useAccountSettings.mockReturnValue(
      settings({ speakerFieldErrors: { github: "Enter a valid full URL (https://…)." } }),
    );

    render(<AccountSettings />);

    const github = screen.getByLabelText("GitHub") as HTMLInputElement;
    expect(github.getAttribute("aria-invalid")).toBe("true");
    expect(github.getAttribute("aria-describedby")).toBe("github-url-error");
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid full URL (https://…).");
  });

  it("shows a loading placeholder until the speaker profile resolves", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ speakerProfileId: undefined }));

    render(<AccountSettings />);

    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders the uploaded photo as the preview", () => {
    hooks.useAccountSettings.mockReturnValue(
      settings({
        currentUser: {
          id: 1,
          role: ROLES.SPEAKER,
          full_name: "Ada",
          email: "ada@example.com",
          profile_image_url: "https://cdn.example/a.jpg",
        },
      }),
    );

    const { container } = render(<AccountSettings />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/a.jpg");
  });

  it("shows the email-verification notice once the change is sent", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ emailSent: true, newEmail: "new@example.com" }));

    render(<AccountSettings />);

    expect(screen.getByText(/Verification link sent to/)).toBeTruthy();
  });

  it("renders an inline email rejection on the email input", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ emailError: "This is already your email address." }));

    render(<AccountSettings />);

    const input = screen.getByPlaceholderText("new@example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-error");
    expect(screen.getByText("This is already your email address.")).toBeTruthy();
  });

  it("renders a name rejection inline", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ nameError: "Name is required." }));

    render(<AccountSettings />);

    expect(screen.getByText("Name is required.")).toBeTruthy();
    const input = screen.getByLabelText("Name");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders a toast and calls dismissToast once it closes", () => {
    vi.useFakeTimers();
    const dismissToast = vi.fn();
    hooks.useAccountSettings.mockReturnValue(
      settings({ toast: { title: "Saved", description: "Professional info updated.", type: "success" }, dismissToast }),
    );

    render(<AccountSettings />);

    expect(screen.getByText("Saved")).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    expect(dismissToast).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
