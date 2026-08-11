// @vitest-environment jsdom
import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";

const { getSession, usePathname } = vi.hoisted(() => ({
  getSession: vi.fn(),
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const browserAuth = { updateUser: vi.fn() };
vi.mock("@/shared/db/browser-client", () => ({ getBrowserClient: () => ({ auth: browserAuth }) }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession,
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import { SessionProvider } from "@/modules/auth/components/session-context";
import { TopNavbar } from "@/modules/shell/components/top-navbar";
import { useAccountSettings } from "@/modules/user/lib/use-account-settings";
import { ProfilePhotoSection } from "@/modules/user/components/profile-photo-section";

const appUser = {
  id: 1,
  role: ROLES.ATTENDEE,
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  profile_image_url: null,
};

const submitEvent = { preventDefault: () => {} } as React.FormEvent;

type Settings = ReturnType<typeof useAccountSettings>;

/** Renders the real settings hook next to the real navbar, both under one session. */
function harness() {
  const captured: { current: Settings | null } = { current: null };

  // The real photo section, wired to the session exactly as the settings page
  // wires it, so the circular preview is what the assertions actually read.
  function Settings() {
    const settings = useAccountSettings();
    captured.current = settings;
    return (
      <ProfilePhotoSection
        previewUrl={settings.currentUser?.profile_image_url}
        uploading={settings.uploading}
        onChange={settings.changeProfilePhoto}
      />
    );
  }

  render(
    <SessionProvider>
      <TopNavbar />
      <Settings />
    </SessionProvider>,
  );

  return captured;
}

/** The name the navbar's profile menu is currently showing. */
function navbarName(): string {
  return screen.getByRole("button", { name: /Ada|Grace|ada@example\.com/ }).textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: "auth_1" } } as unknown as Session } });
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      const patched = init?.method === "PATCH" ? JSON.parse(String(init.body)) : {};
      return Promise.resolve({ ok: true, json: async () => ({ ...appUser, ...patched }) } as Response);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saving a profile name", () => {
  it("repaints the navbar with the new name, with no reload or refetch of the session", async () => {
    const settings = harness();
    await waitFor(() => expect(navbarName()).toContain("Ada Lovelace"));

    // The navbar paints as soon as the session resolves, which is before the
    // avatar's own lookup has necessarily been issued. Letting mount settle
    // first is what makes the baseline a count of startup rather than a race
    // with it — taken too early, that lookup lands afterwards and reads as a
    // refetch the save caused.
    await act(async () => {});

    const fetchMock = vi.mocked(fetch);
    const meCallsBefore = fetchMock.mock.calls.filter((c) => c[1]?.method !== "PATCH").length;

    await act(async () => {
      settings.current!.setName("Grace Hopper");
    });
    await act(async () => {
      await settings.current!.saveName(submitEvent);
    });

    expect(navbarName()).toContain("Grace Hopper");
    // The name the route echoed is what lands, and it lands without a second
    // GET — re-reading /api/auth/me to learn what we just wrote is wasted work.
    const meCallsAfter = fetchMock.mock.calls.filter((c) => c[1]?.method !== "PATCH").length;
    expect(meCallsAfter).toBe(meCallsBefore);
  });

  it("updates the avatar initials alongside the name", async () => {
    const settings = harness();
    await waitFor(() => expect(navbarName()).toContain("Ada Lovelace"));
    expect(screen.getByText("AL")).toBeTruthy();

    await act(async () => {
      settings.current!.setName("Grace Hopper");
    });
    await act(async () => {
      await settings.current!.saveName(submitEvent);
    });

    expect(screen.getByText("GH")).toBeTruthy();
  });

  it("leaves the navbar on the old name when the save fails", async () => {
    const settings = harness();
    await waitFor(() => expect(navbarName()).toContain("Ada Lovelace"));

    vi.mocked(fetch).mockImplementation((_url, init) =>
      Promise.resolve({ ok: (init as RequestInit)?.method !== "PATCH", json: async () => appUser } as Response),
    );

    await act(async () => {
      settings.current!.setName("Grace Hopper");
    });
    await act(async () => {
      await settings.current!.saveName(submitEvent);
    });

    expect(navbarName()).toContain("Ada Lovelace");
    expect(settings.current!.toast?.type).toBe("error");
  });
});

/** The image inside the settings page's circular preview, if one is showing. */
function previewSrc(): string | null {
  return document.querySelector(".rounded-full img")?.getAttribute("src") ?? null;
}

async function upload(settings: { current: Settings | null }, url: string) {
  vi.mocked(fetch).mockImplementation((target) =>
    Promise.resolve({
      ok: true,
      json: async () => (String(target).includes("/api/upload/profile-image") ? { url } : appUser),
    } as Response),
  );

  await act(async () => {
    await settings.current!.changeProfilePhoto({
      target: { files: [new File(["x"], "x.jpg", { type: "image/jpeg" })] },
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  });
}

describe("uploading a profile photo", () => {
  it("shows the new photo in the settings preview without a reload", async () => {
    const settings = harness();
    await waitFor(() => expect(settings.current!.currentUser).toBeTruthy());
    expect(previewSrc()).toBeNull();

    await upload(settings, "https://cdn.example/new.jpg");

    expect(previewSrc()).toBe("https://cdn.example/new.jpg");
  });

  it("swaps the navbar avatar over from the initials in the same step", async () => {
    const settings = harness();
    await waitFor(() => expect(screen.getByText("AL")).toBeTruthy());

    await upload(settings, "https://cdn.example/new.jpg");

    expect(screen.queryByText("AL")).toBeNull();
    const avatar = document.querySelector("header img");
    expect(avatar?.getAttribute("src")).toBe("https://cdn.example/new.jpg");
  });

  it("leaves the preview empty when the upload fails", async () => {
    const settings = harness();
    await waitFor(() => expect(settings.current!.currentUser).toBeTruthy());

    vi.mocked(fetch).mockImplementation((target) =>
      Promise.resolve({
        ok: !String(target).includes("/api/upload/profile-image"),
        json: async () => ({ error: "Upload failed" }),
      } as Response),
    );
    await act(async () => {
      await settings.current!.changeProfilePhoto({
        target: { files: [new File(["x"], "x.jpg", { type: "image/jpeg" })] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(previewSrc()).toBeNull();
    expect(settings.current!.toast?.type).toBe("error");
  });
});

describe("the name field against a session that arrives late", () => {
  it("fills from the session once it resolves instead of staying blank", async () => {
    const settings = harness();

    // The settings page does not gate on isLoaded, so the hook mounts first.
    expect(settings.current!.name).toBe("");

    await waitFor(() => expect(settings.current!.name).toBe("Ada Lovelace"));
  });

  it("does not clobber an edit in progress on unrelated re-renders", async () => {
    const settings = harness();
    await waitFor(() => expect(settings.current!.name).toBe("Ada Lovelace"));

    await act(async () => {
      settings.current!.setName("Grace");
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(settings.current!.name).toBe("Grace");
  });
});
