// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import EmailLinkExpiredPage from "@/app/email-link-expired/page";

afterEach(() => {
  cleanup();
});

describe("/email-link-expired", () => {
  it("explains the link can no longer be used", () => {
    render(<EmailLinkExpiredPage />);

    expect(screen.getByRole("heading", { name: "Email link no longer valid" })).toBeDefined();
    expect(screen.getByText(/expired or been replaced/i)).toBeDefined();
  });

  it("points back to settings where a fresh link can be sent", () => {
    render(<EmailLinkExpiredPage />);

    expect(screen.getByRole("link", { name: "Go to settings" }).getAttribute("href")).toBe("/user");
  });
});
