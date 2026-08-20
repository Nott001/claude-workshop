import { describe, it, expect } from "vitest";
import { eventListParams, tabScope, PAGE_SIZE } from "@/modules/events/lib/event-list-query";

describe("tabScope", () => {
  // Upcoming and Completed are windows on the calendar, not status values: a
  // past `active` event reads as complete without its column ever being
  // advanced, so asking for status=complete alone would miss every one.
  it("asks the archive for both statuses that can read as finished", () => {
    expect(tabScope("completed", false)).toEqual({ filter: "past", statuses: ["active", "complete"] });
  });

  it("adds drafts to Upcoming only for the view that assigns them", () => {
    expect(tabScope("upcoming", false).statuses).toEqual(["active"]);
    expect(tabScope("upcoming", true).statuses).toEqual(["active", "draft"]);
  });

  // A draft sits on either side of today, so a date window would hide half.
  it("scopes Drafts by status alone, with no calendar window", () => {
    expect(tabScope("drafts", false)).toEqual({ statuses: ["draft"] });
  });
});

describe("eventListParams", () => {
  it("omits the search param entirely when there is no term", () => {
    const params = eventListParams({ tab: "upcoming", search: "", includeDrafts: false, page: 1 });

    expect(params.toString()).toBe(`page=1&limit=${PAGE_SIZE}&filter=upcoming&status=active`);
  });

  it("carries the term and the page through to the API", () => {
    const params = eventListParams({ tab: "completed", search: "summit", includeDrafts: false, page: 3 });

    expect(params.get("page")).toBe("3");
    expect(params.get("filter")).toBe("past");
    expect(params.get("status")).toBe("active,complete");
    expect(params.get("search")).toBe("summit");
  });
});
