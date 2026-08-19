// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeroSection } from "@/modules/shell/components/hero-section";
import { CommunityHero } from "@/modules/community/components/community-hero";

const renderHero = () =>
  render(
    <HeroSection>
      <h1>StartupLab Business Center</h1>
      <button type="button">Join Now</button>
    </HeroSection>,
  );

afterEach(cleanup);

describe("HeroSection", () => {
  it("renders the page's own heading and call to action", () => {
    renderHero();

    expect(screen.getByRole("heading", { name: "StartupLab Business Center" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join Now" })).toBeTruthy();
  });

  // The hero used to show a play_circle glyph over a gradient tile with no
  // <video> behind it anywhere in the app. Nothing here may promise playback
  // again unless something actually plays.
  it("offers no playback affordance", () => {
    const { container } = renderHero();

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".material-symbols-rounded")).toBeNull();
    expect(container.textContent).not.toMatch(/play_/);
  });

  // The two-column track only existed to seat that tile. Left behind, it gave
  // the landing hero an empty right half.
  it("lays the copy out in one column", () => {
    const { container } = renderHero();

    expect(container.querySelector('[class*="grid-cols"]')).toBeNull();
  });

  it("holds the copy to a readable measure instead of the panel's full width", () => {
    renderHero();

    const wrapper = screen.getByRole("heading").parentElement;

    expect(wrapper?.className).toContain("max-w-3xl");
  });

  it("keeps the background wash out of the accessibility tree", () => {
    const { container } = renderHero();

    const wash = container.querySelector("[aria-hidden]");

    expect(wash).not.toBeNull();
    expect(wash?.textContent).toBe("");
  });
});

// Three full-bleed heroes sit under the navbar on different pages, and a reader
// moving between them sees the same panel change fill. They keep one silhouette
// by naming the same token, not by two files happening to agree on 40px today.
describe("hero silhouette", () => {
  const foot = (el: Element | null) => [...(el?.classList ?? [])].find((c) => c.endsWith("rounded-b-hero"));

  it("cuts the brand panel and the community hero with the same foot", () => {
    const brand = renderHero().container.querySelector("section");
    cleanup();
    const community = render(<CommunityHero />).container.querySelector("section");

    expect(foot(brand)).toBe("rounded-b-hero");
    expect(foot(community)).toBe("rounded-b-hero");
  });

  it("clips the community hero's photograph to that foot", () => {
    const { container } = render(<CommunityHero />);

    const section = container.querySelector("section");

    // The photo and both scrims are `absolute inset-0`; without the clip they
    // would square off the corners the section just rounded.
    expect(section?.className).toContain("overflow-hidden");
    expect(section?.querySelector("img")).not.toBeNull();
  });
});

// The landing hero's copy arrives a line at a time; the community hero sits
// under the same navbar, is cut with the same foot, and used to be the one that
// simply appeared.
describe("community hero entry", () => {
  it("rises its copy in, staggered, the way the landing hero does", () => {
    render(<CommunityHero />);

    const heading = screen.getByRole("heading", { name: /Connect, Share/ });
    const body = heading.parentElement?.querySelector("p");

    expect(heading.className).toContain("hero-rise");
    // A stagger, not two lines moving as one block.
    expect(body?.className).toContain("hero-rise");
    expect(body?.className).toContain("hero-rise-1");
    expect(heading.className).not.toContain("hero-rise-1");
  });

  // Chrome does not count an element as painted while it is still transparent,
  // so animating the photograph would push the page's largest paint back by the
  // length of the animation.
  it("leaves the LCP photograph out of the animation", () => {
    const { container } = render(<CommunityHero />);

    expect(container.querySelector("img")?.className).not.toContain("hero-rise");
  });
});
