// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProfilePhotoSection } from "@/modules/user/components/profile-photo-section";

function renderSection(overrides: Partial<React.ComponentProps<typeof ProfilePhotoSection>> = {}) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <ProfilePhotoSection
      previewUrl={null}
      uploading={false}
      deleting={false}
      onChange={onChange}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onChange, onDelete, ...utils };
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Profile photo" }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProfilePhotoSection avatar", () => {
  it("offers no Upload photo button; the avatar itself is the control", () => {
    renderSection();

    expect(screen.getByRole("button", { name: "Profile photo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Upload photo/ })).toBeNull();
  });

  it("paints a hover hint over the avatar even with no photo", () => {
    renderSection();

    // The pencil is the design's affordance: invisible until hover or keyboard
    // focus, but present so the ring stays focusable and the control reads as
    // one surface rather than a button.
    const glyphs = [...document.querySelectorAll(".material-symbols-rounded")].map((el) => el.textContent);
    expect(glyphs).toContain("edit");
  });
});

describe("ProfilePhotoSection photo menu", () => {
  it("opens on clicking the avatar and offers Upload photo", () => {
    renderSection();
    expect(screen.queryByText("Upload photo")).toBeNull();

    openMenu();

    expect(screen.getByText("Upload photo")).toBeTruthy();
  });

  it("offers Delete photo only when a photo exists", () => {
    renderSection({ previewUrl: null });
    openMenu();
    expect(screen.queryByText("Delete photo")).toBeNull();

    cleanup();
    renderSection({ previewUrl: "https://cdn.example/a.jpg" });
    openMenu();
    expect(screen.getByText("Delete photo")).toBeTruthy();
  });

  it("opens the hidden file input when Upload photo is chosen, and a chosen file flows to onChange", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const { onChange, container } = renderSection();
    openMenu();

    fireEvent.click(screen.getByText("Upload photo"));

    expect(clickSpy).toHaveBeenCalledTimes(1);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when Delete photo is chosen", () => {
    const { onDelete } = renderSection({ previewUrl: "https://cdn.example/a.jpg" });
    openMenu();

    fireEvent.click(screen.getByText("Delete photo"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables Upload photo while an upload is in flight", () => {
    renderSection({ uploading: true });
    openMenu();

    const item = screen.getByRole("menuitem", { name: "Uploading\u2026" });
    expect(item.hasAttribute("data-disabled")).toBe(true);
  });

  it("disables Delete photo while a delete is in flight", () => {
    renderSection({ previewUrl: "https://cdn.example/a.jpg", deleting: true });
    openMenu();

    const item = screen.getByRole("menuitem", { name: "Deleting\u2026" });
    expect(item.hasAttribute("data-disabled")).toBe(true);
  });
});
