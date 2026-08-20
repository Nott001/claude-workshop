// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StaffPage, StaffPageHeader, StaffPageState, StaffPageSkeleton } from "@/shared/components/staff-page";
import { expectStaffColumn } from "./helpers/staff-column";

afterEach(cleanup);

describe("StaffPage", () => {
  it("puts its children inside the measured column", () => {
    const { container } = render(
      <StaffPage>
        <p>Body</p>
      </StaffPage>,
    );

    expectStaffColumn(container);
    expect(container.querySelector('[class~="max-w-page"]')!.textContent).toBe("Body");
  });
});

describe("StaffPageHeader", () => {
  // The facilitator's page had titled itself with a bare <span>, so its heading
  // was not a heading to anything that navigates by them.
  it("renders the title as the page's heading", () => {
    render(<StaffPageHeader title="My Events" />);

    expect(screen.getByRole("heading", { level: 1, name: "My Events" })).toBeTruthy();
  });

  it("renders a description when the page has one, and nothing when it does not", () => {
    const { rerender, container } = render(<StaffPageHeader title="Events" description="Create and publish." />);
    expect(screen.getByText("Create and publish.")).toBeTruthy();

    rerender(<StaffPageHeader title="Events" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("places the page's primary control opposite the title", () => {
    render(<StaffPageHeader title="Events" actions={<button>Create Event</button>} />);

    expect(screen.getByRole("button", { name: "Create Event" })).toBeTruthy();
  });
});

describe("StaffPageState", () => {
  // `text-muted-foreground` and `text-destructive` are not tokens in this theme,
  // so the pages that reached for them emitted no colour rule at all.
  it("colours itself with tokens the theme actually defines", () => {
    const { rerender } = render(<StaffPageState>Loading...</StaffPageState>);
    expect(screen.getByText("Loading...").className).toContain("text-muted-fg");

    rerender(<StaffPageState tone="error">Failed</StaffPageState>);
    expect(screen.getByText("Failed").className).toContain("text-error");
  });

  it("names no colour this theme does not define", () => {
    const { container } = render(<StaffPageState tone="error">Failed</StaffPageState>);

    expect(container.innerHTML).not.toContain("foreground");
    expect(container.innerHTML).not.toContain("destructive");
  });
});

// One centred line left the shell's flex column almost empty, so every staff
// page took the same layout shift when its header and table arrived — one
// shared cause behind a shift on all seven, not seven page bugs.
describe("StaffPageSkeleton", () => {
  it("reserves the staff column rather than centring a line in it", () => {
    const { container } = render(<StaffPageSkeleton />);

    expectStaffColumn(container);
    expect(screen.getByLabelText("Loading page")).toBeTruthy();
  });

  it("reserves eleven rows by default, which is what five of the seven settle at", () => {
    const { container } = render(<StaffPageSkeleton />);

    // The header block and the toolbar are placeholders too, so count the body.
    expect(container.querySelectorAll(".divide-y > *")).toHaveLength(11);
  });

  it("lets the pages that list more say so", () => {
    const { container } = render(<StaffPageSkeleton rows={20} />);

    expect(container.querySelectorAll(".divide-y > *")).toHaveLength(20);
  });
});
