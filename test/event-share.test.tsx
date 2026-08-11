// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EventShare } from "@/modules/events/components/event-share";

const open = vi.fn();
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  open.mockClear();
  writeText.mockClear();
  window.open = open as typeof window.open;
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(cleanup);

describe("EventShare", () => {
  it("opens Facebook and LinkedIn share URLs in new windows", () => {
    render(<EventShare />);

    fireEvent.click(screen.getByRole("button", { name: /share on facebook/i }));
    expect(open).toHaveBeenCalledWith(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
      "_blank",
      "noopener",
    );

    fireEvent.click(screen.getByRole("button", { name: /share on linkedin/i }));
    expect(open).toHaveBeenCalledWith(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`,
      "_blank",
      "noopener",
    );
  });

  it("copies the current URL to the clipboard and shows the Copied confirmation", async () => {
    render(<EventShare />);

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await screen.findByText("Copied");
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
});
