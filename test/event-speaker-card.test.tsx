// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { EventSpeakerCard } from "@/modules/events/components/event-speaker-card";
import type { EventSpeakerProfile } from "@/modules/events/lib/types";

const baseSpeaker: EventSpeakerProfile = {
  id: 1,
  user_id: 10,
  bio: "Jane has spent six years helping teams adopt practical AI tooling.",
  designation: "Lead AI Solutions Architect",
  photo_url: "/jane.jpg",
  linkedin_url: "https://linkedin.com/in/jane",
  twitter_url: null,
  github_url: "https://github.com/jane",
  website_url: null,
  USER: { full_name: "Jane Smith", email: "jane@example.com" },
};

afterEach(cleanup);

describe("EventSpeakerCard", () => {
  it("renders the compact tile with photo, name and designation", () => {
    render(<EventSpeakerCard speaker={baseSpeaker} />);

    expect(screen.getByRole("img", { name: "Jane Smith" })).toBeTruthy();
    expect(screen.getByText("Jane Smith")).toBeTruthy();
    expect(screen.getByText("Lead AI Solutions Architect")).toBeTruthy();
  });

  it("renders the initials circle instead of a photo when photo_url is null", () => {
    render(<EventSpeakerCard speaker={{ ...baseSpeaker, photo_url: null }} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("JS")).toBeTruthy();
  });

  it("opens the overlay on click, showing the bio when present", () => {
    render(<EventSpeakerCard speaker={baseSpeaker} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /jane smith/i }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(baseSpeaker.bio!)).toBeTruthy();
  });

  it("omits the bio from the overlay when it is null", () => {
    render(<EventSpeakerCard speaker={{ ...baseSpeaker, bio: null }} />);

    fireEvent.click(screen.getByRole("button", { name: /jane smith/i }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByText(/spent six years/i)).toBeNull();
  });

  it("renders only the social links that have URLs, linking out with rel=noopener", () => {
    render(<EventSpeakerCard speaker={baseSpeaker} />);
    fireEvent.click(screen.getByRole("button", { name: /jane smith/i }));

    const linkedin = screen.getByRole("link", { name: "LinkedIn" });
    const github = screen.getByRole("link", { name: "GitHub" });

    expect(linkedin.getAttribute("href")).toBe("https://linkedin.com/in/jane");
    expect(linkedin.getAttribute("target")).toBe("_blank");
    expect(linkedin.getAttribute("rel")).toBe("noopener");
    expect(github.getAttribute("href")).toBe("https://github.com/jane");
    expect(screen.queryByRole("link", { name: "X" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Website" })).toBeNull();
  });
});
