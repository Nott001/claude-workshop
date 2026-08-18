import { expect } from "vitest";
import { STAFF_PAGE_CONTAINER } from "@/shared/components/staff-page";

/**
 * Asserts a rendered page sits in the one column every staff page shares.
 *
 * Lives here because three suites ask it of different pages, and a page that
 * opts out of the frame is the failure worth catching — so the question has to
 * be cheap enough that the next page's test asks it too.
 *
 * Selected as a class token rather than with `.max-w-page`, since jsdom here
 * has no `CSS.escape` to quote a selector with.
 */
export function expectStaffColumn(container: HTMLElement, label?: string): void {
  const frames = container.querySelectorAll('[class~="max-w-page"]');
  expect(frames, label).toHaveLength(1);

  for (const cls of STAFF_PAGE_CONTAINER.split(" ")) {
    expect(frames[0].classList.contains(cls), label ? `${label}: ${cls}` : cls).toBe(true);
  }
}
