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
  it("returns null when signed out and never fetches", () => {
    render(<Host user={null} />);

    expect(photoText()).toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("shows a photo arriving on the session, having had none", async () => {
    const { rerender } = render(<Host user={{ profile_image_url: null }} />);
    await act(async () => {});

    rerender(<Host user={{ profile_image_url: "https://cdn/new.jpg" }} />);
    expect(photoText()).toBe("https://cdn/new.jpg");
  });

  // The user had no app photo, so the speaker one was fetched into state. Read
  // in the wrong order that stale photo outlives the upload that replaced it.
  it("adopts the session user's profile_image_url when it appears after a speaker fallback", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ photo_url: "https://cdn/b.jpg" }) });
    const { rerender } = render(<Host user={{ profile_image_url: null }} />);

    await waitFor(() => expect(photoText()).toBe("https://cdn/b.jpg"));

    rerender(<Host user={{ profile_image_url: "https://cdn/a.jpg" }} />);
    expect(photoText()).toBe("https://cdn/a.jpg");
  });

  it("does not re-request the speaker photo when an unrelated session field changes", async () => {
    const { rerender } = render(<Host user={{ profile_image_url: null }} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // A rename hands down a new user object with the same photo URL.
    rerender(<Host user={{ profile_image_url: null }} />);
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
