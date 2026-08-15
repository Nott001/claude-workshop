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
    savedNotice: null,
    dismissSavedNotice: vi.fn(),
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
    cancelEmailChange: vi.fn(),
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

  it("routes typed designation and bio through their handlers", () => {
    const setDesignation = vi.fn();
    const setBio = vi.fn();
    hooks.useAccountSettings.mockReturnValue(
      settings({
        designation: "CTO",
        bio: "Leads the team.",
        setDesignation,
        setBio,
      }),
    );

    render(<AccountSettings />);

    const designation = screen.getByLabelText("Designation") as HTMLInputElement;
    const bio = screen.getByLabelText("Bio") as HTMLTextAreaElement;
    expect(designation.value).toBe("CTO");
    expect(bio.value).toBe("Leads the team.");

    fireEvent.change(designation, { target: { value: "CTO Emeritus" } });
    fireEvent.change(bio, { target: { value: "Now mentoring." } });
    expect(setDesignation).toHaveBeenCalledWith("CTO Emeritus");
    expect(setBio).toHaveBeenCalledWith("Now mentoring.");
  });

  it("routes the password fields through their handlers", () => {
    const setCurrentPassword = vi.fn();
    const setNewPassword = vi.fn();
    hooks.useAccountSettings.mockReturnValue(
      settings({
        currentPassword: "old-pass",
        newPassword: "new-pass",
        setCurrentPassword,
        setNewPassword,
      }),
    );

    render(<AccountSettings />);

    const current = screen.getByLabelText("Current password") as HTMLInputElement;
    const fresh = screen.getByLabelText("New password") as HTMLInputElement;
    expect(current.value).toBe("old-pass");
    expect(fresh.value).toBe("new-pass");

    fireEvent.change(current, { target: { value: "old-pass-2" } });
    fireEvent.change(fresh, { target: { value: "new-pass-2" } });
    expect(setCurrentPassword).toHaveBeenCalledWith("old-pass-2");
    expect(setNewPassword).toHaveBeenCalledWith("new-pass-2");
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

  it("shows the email-change pending status once the change is sent", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ emailSent: true, newEmail: "new@example.com" }));

    render(<AccountSettings />);

    expect(screen.getByText("Email change pending")).toBeTruthy();
  });

  it("dismisses the pending status through the renamed prop", () => {
    const cancelEmailChange = vi.fn();
    hooks.useAccountSettings.mockReturnValue(settings({ emailSent: true, newEmail: "new@example.com", cancelEmailChange }));

    render(<AccountSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancelEmailChange).toHaveBeenCalled();
  });

  it("renders an inline email rejection on the email input", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ emailError: "This is already your email address." }));

    render(<AccountSettings />);

    const input = screen.getByPlaceholderText("you@example.com");
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

  it("routes typed name changes through the handler", () => {
    const setName = vi.fn();
    hooks.useAccountSettings.mockReturnValue(settings({ full_name: "Ada", setName }));

    render(<AccountSettings />);

    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.value).toBe("Ada");

    fireEvent.change(input, { target: { value: "Ada Lovelace" } });
    expect(setName).toHaveBeenCalledWith("Ada Lovelace");
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

  it("renders the green success box above Save Changes while a notice is set", () => {
    hooks.useAccountSettings.mockReturnValue(settings({ savedNotice: "Your profile has been updated." }));

    render(<AccountSettings />);

    expect(screen.getByText("Your profile has been updated.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  it("dismisses the success box and calls the hook's dismiss", () => {
    const dismissSavedNotice = vi.fn();
    hooks.useAccountSettings.mockReturnValue(settings({ savedNotice: "Your profile has been updated.", dismissSavedNotice }));

    render(<AccountSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(dismissSavedNotice).toHaveBeenCalledTimes(1);
  });

  it("renders no success box when no notice is set", () => {
    hooks.useAccountSettings.mockReturnValue(settings());

    render(<AccountSettings />);

    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeTruthy();
  });
});
