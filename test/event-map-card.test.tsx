// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventMapCard } from "@/modules/events/components/event-map-card";

afterEach(cleanup);

describe("EventMapCard", () => {
  it("renders the venue text and a Google Maps link in a new tab", () => {
    render(<EventMapCard event={{ venue_name: "Hall A", venue_address: "123 Main St" }} />);

    expect(screen.getByText("Hall A, 123 Main St")).toBeTruthy();

    const link = screen.getByRole("link", { name: /view in google maps/i });
    expect(link.getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=Hall%20A%2C%20123%20Main%20St");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
  });

  it("renders nothing when the venue is empty", () => {
    const { container } = render(<EventMapCard event={{ venue_name: null, venue_address: null }} />);

    expect(container.firstChild).toBeNull();
  });
});
