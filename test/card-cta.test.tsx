// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CardCta } from "@/shared/components/card-cta";

afterEach(cleanup);

describe("CardCta", () => {
  it("renders the label the caller gave it", () => {
    render(<CardCta>View 12 photos</CardCta>);

    expect(screen.getByText("View 12 photos")).toBeTruthy();
  });

  it("keeps the chevron out of the accessibility tree", () => {
    const { container } = render(<CardCta>View details</CardCta>);

    // One copy of this had lost `aria-hidden`, which reads the ligature text
    // "chevron_right" out loud after the label.
    const icon = container.querySelector(".material-symbols-rounded");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.textContent).toBe("chevron_right");
  });

  it("is not a link, so it can sit inside a card that already is one", () => {
    const { container } = render(<CardCta>View details</CardCta>);

    // A nested anchor is invalid markup and gives the card two tab stops.
    expect(container.querySelector("a")).toBeNull();
    expect(container.firstElementChild?.tagName).toBe("SPAN");
  });

  it("takes extra classes from the caller without losing its own", () => {
    const { container } = render(<CardCta className="mt-auto pt-4">View memories</CardCta>);

    const cls = container.firstElementChild?.className ?? "";
    expect(cls).toContain("mt-auto");
    expect(cls).toContain("text-brand");
  });
});
