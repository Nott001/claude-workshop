// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { SupportWaitingNotice } from "@/modules/support/components/support-waiting-notice";

afterEach(() => {
  cleanup();
});

describe("SupportWaitingNotice", () => {
  it("renders the wait-for-pickup copy when visible", () => {
    render(<SupportWaitingNotice visible />);
    expect(screen.getByText(/Someone will pick up your case soon/)).toBeTruthy();
  });

  it("renders nothing when the case has been assigned", () => {
    render(<SupportWaitingNotice visible={false} />);
    expect(screen.queryByText(/pick up your case/)).toBeNull();
  });
});
