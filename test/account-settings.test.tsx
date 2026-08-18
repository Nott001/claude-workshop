// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { expectStaffColumn } from "./helpers/staff-column";
import { profileNameHint } from "@/modules/user/lib/profile-name-hint";

const hooks = vi.hoisted(() => ({ useAccountSettings: vi.fn() }));

vi.mock("@/modules/user/lib/use-account-settings", () => ({ useAccountSettings: hooks.useAccountSettings }));

import { AccountSettings } from "@/modules/user/components/account-settings";
import type { useAccountSettings } from "@/modules/user/lib/use-account-settings";

type Settings = ReturnType<typeof useAccountSettings>;
type Overrides = { [K in keyof Settings]?: Partial<Settings[K]> };

const LINKS = [
  {
    key: "linkedin",
    id: "linkedin-url",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
    value: "https://linkedin.com/in/ada",
    saved: "https://linkedin.com/in/ada",
  },
  { key: "twitter", id: "twitter-url", label: "X (Twitter)", placeholder: "https://x.com/username", value: "", saved: "" },
  {
    key: "github",
    id: "github-url",
    label: "GitHub",
    placeholder: "https://github.com/username",
    value: "https://github.com/ada",
    saved: "https://github.com/ada",
  },
  { key: "website", id: "website-url", label: "Website", placeholder: "https://yoursite.com", value: "", saved: "" },
] as const;

/**
 * The page reads one object per card off the hook, so the harness builds those
 * and lets a case override a single field without restating the rest.
 */
function settings(overrides: Overrides = {}) {
  const base = {
    toast: null,
    dismissToast: vi.fn(),
    notify: vi.fn(),
    currentUser: { id: 1, role: ROLES.SPEAKER, full_name: "Ada", email: "ada@example.com", profile_image_url: null },
    savingSection: null,
    savedSection: null,
    profile: { name: "Ada", setName: vi.fn(), nameError: null, dirty: false, saving: false, saved: false, save: vi.fn() },
    email: {
      value: "ada@example.com",
      setValue: vi.fn(),
      error: null,
      sent: false,
      verified: null,
      dismissVerified: vi.fn(),
      resendIn: 0,
      resend: vi.fn(),
      cancel: vi.fn(),
      dirty: false,
      saving: false,
      save: vi.fn(),
    },
    password: {
      current: "",
      setCurrent: vi.fn(),
      currentError: null,
      next: "",
      setNext: vi.fn(),
      nextError: null,
      dirty: false,
      saving: false,
      saved: false,
      save: vi.fn(),
    },
    speaker: {
      isSpeaker: true,
      loading: false,
      designation: "CTO",
      setDesignation: vi.fn(),
      bio: "Leads.",
      setBio: vi.fn(),
      links: LINKS.map((l) => ({ ...l, onChange: vi.fn() })),
      errors: {},
      dirty: false,
      saving: false,
      saved: false,
      save: vi.fn(),
    },
    photo: { url: null, uploading: false, deleting: false, change: vi.fn(), remove: vi.fn() },
  };

  for (const [group, fields] of Object.entries(overrides)) {
    Object.assign(base[group as keyof typeof base] as object, fields);
  }
  return base;
}

function renderPage(overrides: Overrides = {}) {
  const value = settings(overrides);
  hooks.useAccountSettings.mockReturnValue(value);
  const view = render(<AccountSettings />);
  return { ...view, value };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("the page frame", () => {
  // Settings was the one signed-in page on its own narrower column, which made
  // moving between it and the staff pages a visible jump.
  it("sits in the same measured column every staff page shares", () => {
    const { container } = renderPage();

    expectStaffColumn(container);
  });

  // Full-width panels stacked in the page column, the same shape the staff
  // event page uses — no side rail, and nothing holding the cards to a
  // narrower measure than the frame they sit in.
  it("stacks every card full width, with no navigation rail", () => {
    const { container } = renderPage();

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(container.querySelector(".max-w-page .space-y-6")).toBeTruthy();
    expect(container.querySelector('[class*="max-w-3xl"]')).toBeNull();
  });

  it("renders one card per concern, in order", () => {
    renderPage();

    const ids = [...document.querySelectorAll("section[id]")].map((s) => s.id);
    expect(ids).toEqual(["profile", "email", "password", "speaker", "danger"]);
  });

  it("drops the speaker card for a non-speaker", () => {
    renderPage({ speaker: { isSpeaker: false } });

    const ids = [...document.querySelectorAll("section[id]")].map((s) => s.id);
    expect(ids).toEqual(["profile", "email", "password", "danger"]);
  });

  // The cards are the same panel the staff event page renders, so the two
  // pages cannot drift apart in padding or heading weight.
  it("wears the same card chrome as the staff event panels", () => {
    renderPage();

    const card = document.querySelector("section#profile")!;
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("border-border");
    expect(screen.getByRole("heading", { name: "PROFILE" })).toBeTruthy();
  });
});

describe("one save per card", () => {
  // The single Save Changes could rename the account, mail a link and change
  // the password in one press. Each card owns its own action now, and says
  // what that action does.
  it("gives each card its own button, named for what it does", () => {
    renderPage();

    for (const name of ["Save profile", "Send verification link", "Update password"]) {
      expect(screen.getByRole("button", { name }), name).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
  });

  it("submits only the card that was pressed", () => {
    const { value } = renderPage({ profile: { dirty: true }, password: { dirty: true } });

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(value.profile.save).toHaveBeenCalledTimes(1);
    expect(value.password.save).not.toHaveBeenCalled();
    expect(value.email.save).not.toHaveBeenCalled();
  });

  it("disables a card's button while that card is clean", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Save profile" }).hasAttribute("disabled")).toBe(true);
  });

  it("enables only the dirty card, leaving the others down", () => {
    renderPage({ password: { dirty: true } });

    expect(screen.getByRole("button", { name: "Update password" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Save profile" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows the in-flight label on the saving card alone", () => {
    renderPage({ password: { dirty: true, saving: true }, profile: { dirty: true } });

    expect(screen.getByRole("button", { name: "Updating…" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeTruthy();
  });

  // A confirmation that named no card was the reason the old one had to
  // reconstruct which combination of writes it was reporting.
  it("confirms in the card that saved and nowhere else", () => {
    renderPage({ password: { saved: true } });

    expect(screen.getByText("Password updated")).toBeTruthy();
    expect(screen.queryByText("Profile saved")).toBeNull();
  });
});

describe("the cards", () => {
  it("renders the account fields for any signed-in user", () => {
    renderPage({ speaker: { isSpeaker: false } });

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getByLabelText("Current password")).toBeTruthy();
    expect(screen.getByLabelText("New password")).toBeTruthy();
  });

  // The card renders before the session resolves, so it has to survive an
  // account address that is not there yet.
  it("shows the account address read-only, and survives not having one", () => {
    renderPage();
    expect((screen.getByLabelText("Account email") as HTMLInputElement).value).toBe("ada@example.com");
    expect((screen.getByLabelText("Account email") as HTMLInputElement).disabled).toBe(true);

    cleanup();
    renderPage({ currentUser: { email: undefined } });
    expect((screen.getByLabelText("Account email") as HTMLInputElement).value).toBe("");
  });

  it("routes typed values through the handler that owns them", () => {
    const { value } = renderPage();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Grace" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old" } });

    expect(value.profile.setName).toHaveBeenCalledWith("Grace");
    expect(value.password.setCurrent).toHaveBeenCalledWith("old");
  });

  // A field can carry standing guidance and a rejection at once, and naming
  // only the error would silence the hint exactly when it is most needed.
  it("describes a rejected field by both its error and its hint", () => {
    renderPage({ profile: { nameError: "Name is required." } });

    const field = screen.getByLabelText("Name");
    expect(field.getAttribute("aria-invalid")).toBe("true");

    const described = field
      .getAttribute("aria-describedby")!
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);

    expect(described).toContain("Name is required.");
    // The harness signs in as a speaker, so the hint is the speaker's.
    expect(described).toContain(profileNameHint(ROLES.SPEAKER));
  });

  // The hint names different surfaces per role; the page's job is to hand the
  // role down so the right one is picked.
  it("hints at the surfaces the signed-in role actually has", () => {
    renderPage();
    expect(screen.getByText(profileNameHint(ROLES.SPEAKER)!)).toBeTruthy();

    cleanup();
    renderPage({ currentUser: { role: ROLES.ATTENDEE } });
    expect(screen.getByText(profileNameHint(ROLES.ATTENDEE)!)).toBeTruthy();
    expect(screen.queryByText(profileNameHint(ROLES.SPEAKER)!)).toBeNull();
  });

  it("offers the reset flow from the password card", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("shows the speaker card only for a speaker", () => {
    renderPage({ speaker: { isSpeaker: false } });
    expect(screen.queryByLabelText("Designation")).toBeNull();

    cleanup();
    renderPage();
    expect(screen.getByLabelText("Designation")).toBeTruthy();
  });

  it("renders every speaker link with its stored value", () => {
    renderPage();

    expect((screen.getByLabelText("LinkedIn") as HTMLInputElement).value).toBe("https://linkedin.com/in/ada");
    expect((screen.getByLabelText("GitHub") as HTMLInputElement).value).toBe("https://github.com/ada");
    expect((screen.getByLabelText("Website") as HTMLInputElement).value).toBe("");
  });

  it("routes a typed speaker link through its own handler", () => {
    const { value } = renderPage();

    fireEvent.change(screen.getByLabelText("GitHub"), { target: { value: "https://github.com/grace" } });

    const github = value.speaker.links.find((l) => l.key === "github")!;
    expect(github.onChange).toHaveBeenCalledWith("https://github.com/grace");
  });

  it("shows a speaker URL rejection on the owning input", () => {
    renderPage({ speaker: { errors: { github: "Enter a valid full URL (https://…)." } } });

    const field = screen.getByLabelText("GitHub");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid full URL (https://…).");
  });

  it("holds the speaker fields back until the profile resolves", () => {
    renderPage({ speaker: { loading: true } });

    expect(screen.queryByLabelText("Designation")).toBeNull();
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  // A pending change replaces the field, so a save beside it would point at
  // nothing.
  it("withdraws the email save while a change is pending", () => {
    renderPage({ email: { sent: true } });

    expect(screen.queryByLabelText("Email address")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send verification link" })).toBeNull();
    expect(screen.getByText("Check your inbox")).toBeTruthy();
  });

  it("renders the stored photo as the preview, and a placeholder without one", () => {
    // The photo carries an empty alt — it is decorative beside the name it
    // belongs to — so it is selected by tag rather than by role.
    renderPage({ photo: { url: "https://cdn.test/ada.jpg" } });
    expect(document.querySelector("img")!.getAttribute("src")).toBe("https://cdn.test/ada.jpg");

    cleanup();
    renderPage();
    expect(document.querySelector("img")).toBeNull();
  });

  it("confirms a saved profile and a saved speaker card in their own footers", () => {
    renderPage({ profile: { saved: true }, speaker: { saved: true } });

    expect(screen.getByText("Profile saved")).toBeTruthy();
    expect(screen.getByText("Professional info saved")).toBeTruthy();
  });

  it("keeps the delete action out of the save buttons", () => {
    renderPage();

    const danger = document.querySelector("section#danger")!;
    expect(danger.querySelector('button[type="submit"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeTruthy();
  });
});

describe("the toast", () => {
  it("renders nothing while there is no message", () => {
    renderPage();

    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("shows the active message", () => {
    const value = settings();
    hooks.useAccountSettings.mockReturnValue({
      ...value,
      toast: { id: 1, title: "Saved", description: "All good.", type: "success" as const },
    });
    render(<AccountSettings />);

    expect(screen.getByText("All good.")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
  });
});
