// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Footer } from "@/modules/shell/components/footer";
import { usesStaffFooter } from "@/modules/shell/lib/footer-links";
import { ROLES } from "@/shared/lib/roles";

afterEach(() => {
  cleanup();
});

function linkHrefs(container: HTMLElement) {
  return [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
}

describe("footer role variant", () => {
  it("gives signed-out visitors, attendees and speakers the full public footer", () => {
    for (const role of [null, ROLES.ATTENDEE, ROLES.SPEAKER] as const) {
      const { container } = render(<Footer role={role} />);

      expect(screen.getByText(/Empowering the next generation of business leaders/)).toBeTruthy();
      expect(screen.getByText("Company")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Contact" })).toBeTruthy();
      expect(screen.getByText(/StartupLab Business Center\. All rights reserved\./)).toBeTruthy();
      // The brand wordmark home link, then About Us — nothing else is a link.
      expect(linkHrefs(container)).toEqual(["/", "https://startuplab.ph/"]);
      cleanup();
    }
  });

  it("keeps staff on the plain copyright bar", () => {
    for (const role of [ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN] as const) {
      const { container } = render(<Footer role={role} />);

      expect(screen.getByText(/StartupLab Business Center\. All rights reserved\./)).toBeTruthy();
      expect(screen.queryByText("Company")).toBeNull();
      expect(screen.queryByText(/Empowering the next generation/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Contact" })).toBeNull();
      expect(linkHrefs(container)).toEqual([]);
      cleanup();
    }
  });

  it("sends About Us off-site in a new tab", () => {
    render(<Footer role={null} />);
    const about = screen.getByRole("link", { name: "About Us" });

    expect(about.getAttribute("href")).toBe("https://startuplab.ph/");
    expect(about.getAttribute("target")).toBe("_blank");
    expect(about.getAttribute("rel")).toBe("noreferrer");
  });

  it("carries no Connect column — attendees reach the org through the contact overlay", () => {
    render(<Footer role={ROLES.ATTENDEE} />);

    expect(screen.queryByText("Connect")).toBeNull();
    expect(screen.queryByLabelText("Website")).toBeNull();
  });

  it("stays pinned to the bottom of the shell in either variant", () => {
    for (const role of [null, ROLES.ADMIN] as const) {
      const { container } = render(<Footer role={role} />);
      expect(container.querySelector("footer")?.className).toContain("mt-auto");
      cleanup();
    }
  });
});

describe("staff footer selection", () => {
  it("treats facilitator and up as staff", () => {
    expect(usesStaffFooter(null)).toBe(false);
    expect(usesStaffFooter(ROLES.ATTENDEE)).toBe(false);
    expect(usesStaffFooter(ROLES.SPEAKER)).toBe(false);
    expect(usesStaffFooter(ROLES.FACILITATOR)).toBe(true);
    expect(usesStaffFooter(ROLES.ADMIN)).toBe(true);
    expect(usesStaffFooter(ROLES.SUPER_ADMIN)).toBe(true);
  });
});
