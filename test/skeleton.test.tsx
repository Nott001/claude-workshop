// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Skeleton, SkeletonText } from "@/shared/components/skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("carries the shared fill and pulse so every placeholder reads the same", () => {
    const { container } = render(<Skeleton />);

    const el = container.firstElementChild;
    expect(el?.className).toContain("animate-pulse");
    expect(el?.className).toContain("bg-muted");
  });

  // The list skeleton's cover is square where the default is rounded. Without
  // tailwind-merge both classes land and the later one in the stylesheet wins,
  // which is not the one the caller asked for.
  it("lets a caller replace a default rather than fight it", () => {
    const { container } = render(<Skeleton className="rounded-none" />);

    const el = container.firstElementChild;
    expect(el?.className).toContain("rounded-none");
    expect(el?.className.split(/\s+/)).not.toContain("rounded");
  });
});

describe("SkeletonText", () => {
  it("renders one bar per width, at the widths given", () => {
    const { container } = render(<SkeletonText widths={["w-full", "w-2/3"]} />);

    const bars = [...container.querySelectorAll(".animate-pulse")];
    expect(bars).toHaveLength(2);
    expect(bars[0].className).toContain("w-full");
    expect(bars[1].className).toContain("w-2/3");
  });

  // A stack of identical bars reads as a loading graphic; unequal ones read as
  // a paragraph that has not arrived.
  it("does not force every line to the same width", () => {
    const { container } = render(<SkeletonText widths={["w-full", "w-full", "w-4/5"]} />);

    const widths = [...container.querySelectorAll(".animate-pulse")].map((b) =>
      [...b.classList].find((c) => c.startsWith("w-")),
    );
    expect(new Set(widths).size).toBeGreaterThan(1);
  });
});
