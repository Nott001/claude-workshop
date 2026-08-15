// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Footer } from "@/modules/shell/components/footer";

afterEach(() => {
  cleanup();
});

function openContactOverlay() {
  render(<Footer />);
  fireEvent.click(screen.getByRole("button", { name: "Contact" }));
}

describe("contact overlay", () => {
  it("stays shut until the footer's Contact item is used", () => {
    render(<Footer />);

    expect(screen.queryByText("Contact Information")).toBeNull();
    expect(screen.getByRole("button", { name: "Contact" })).toBeTruthy();
  });

  it("shows every channel once opened", () => {
    openContactOverlay();

    expect(screen.getByText("Contact Information")).toBeTruthy();
    expect(screen.getByRole("link", { name: "hello@startuplab.ph" }).getAttribute("href")).toBe("mailto:hello@startuplab.ph");
    // The dialled number carries no spaces, unlike the number on screen.
    expect(screen.getByRole("link", { name: "+63 917 715 2587" }).getAttribute("href")).toBe("tel:+639177152587");
    expect(screen.getByText("2nd Floor Pearl Plaza Building")).toBeTruthy();
    expect(screen.getByText("7001 Felix Avenue, Barangay Navarro")).toBeTruthy();
    expect(screen.getByText("General Trias, Cavite, Philippines")).toBeTruthy();
    expect(screen.getByText("Monday – Friday: 9:00 AM – 6:00 PM")).toBeTruthy();
    expect(screen.getByText("Saturday – Sunday: Closed")).toBeTruthy();
  });

  it("closes again from the overlay's close button", () => {
    openContactOverlay();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByText("Contact Information")).toBeNull();
  });
});
