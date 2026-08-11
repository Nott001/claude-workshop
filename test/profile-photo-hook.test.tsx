// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { getInitials, useProfilePhoto } from "@/modules/shell/lib/profile";

function Host({ user }: { user: { profile_image_url: string | null } | null }) {
  const photo = useProfilePhoto(user);
  return <div data-testid="photo">{photo ?? "none"}</div>;
}

function photoText(): string | null {
  return screen.getByTestId("photo").textContent;
}

function dispatchedPhoto(photoUrl: string) {
  return () => window.dispatchEvent(new CustomEvent("profile-photo-updated", { detail: { photoUrl } }));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => null });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getInitials", () => {
  it("returns an empty string for missing or blank names", () => {
    expect(getInitials()).toBe("");
    expect(getInitials(null)).toBe("");
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });

  it("returns the single initial for a one-word name", () => {
    expect(getInitials("Ada")).toBe("A");
  });

  it("returns the first and last initials for a multi-word name", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("uppercases the initials", () => {
    expect(getInitials("ada lovelace")).toBe("AL");
  });
});

describe("useProfilePhoto", () => {
  it("returns null when signed out and never fetches or listens", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<Host user={null} />);

    expect(photoText()).toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(addSpy.mock.calls.some(([name]) => name === "profile-photo-updated")).toBe(false);
  });

  it("returns profile_image_url as-is and does not fetch", () => {
    render(<Host user={{ profile_image_url: "https://cdn/a.jpg" }} />);

    expect(photoText()).toBe("https://cdn/a.jpg");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/auth/me when profile_image_url is missing and adopts photo_url", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ photo_url: "https://cdn/b.jpg" }) });
    render(<Host user={{ profile_image_url: null }} />);

    await waitFor(() => expect(photoText()).toBe("https://cdn/b.jpg"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me");
  });

  it("leaves the photo null when /api/auth/me has no photo_url", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ photo_url: null }) });
    render(<Host user={{ profile_image_url: null }} />);

    await act(async () => {});
    expect(photoText()).toBe("none");
  });

  it("leaves the photo null when /api/auth/me fails", async () => {
    render(<Host user={{ profile_image_url: null }} />);

    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me");
    expect(photoText()).toBe("none");
  });

  it("adopts a profile-photo-updated event", () => {
    render(<Host user={{ profile_image_url: null }} />);

    act(dispatchedPhoto("https://cdn/c.jpg"));
    expect(photoText()).toBe("https://cdn/c.jpg");
  });

  it("lets a profile-photo-updated event win over a pre-set profile_image_url", () => {
    render(<Host user={{ profile_image_url: "https://cdn/a.jpg" }} />);

    act(dispatchedPhoto("https://cdn/d.jpg"));
    expect(photoText()).toBe("https://cdn/d.jpg");
  });

  it("removes the profile-photo-updated listener on cleanup", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Host user={{ profile_image_url: null }} />);

    expect(addSpy.mock.calls.some(([name]) => name === "profile-photo-updated")).toBe(true);
    unmount();
    expect(removeSpy.mock.calls.some(([name]) => name === "profile-photo-updated")).toBe(true);
  });
});
