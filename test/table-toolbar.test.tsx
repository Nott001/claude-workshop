// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TableSearch, FilterTabs } from "@/shared/components/table-toolbar";

afterEach(() => {
  cleanup();
});

describe("TableSearch", () => {
  it("forwards the typed value to onChange", () => {
    const onChange = vi.fn();
    render(<TableSearch value="" onChange={onChange} placeholder="Search people..." />);

    fireEvent.change(screen.getByPlaceholderText("Search people..."), { target: { value: "ada" } });

    expect(onChange).toHaveBeenCalledWith("ada");
  });

  it("shows the clear button only while there is text", () => {
    const { rerender } = render(<TableSearch value="" onChange={() => {}} />);

    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    rerender(<TableSearch value="ada" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
  });

  it("clearing empties the value", () => {
    const onChange = vi.fn();
    render(<TableSearch value="ada" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("FilterTabs", () => {
  const tabs = [
    { key: "all", label: "All" },
    { key: "checked_in", label: "Checked in" },
  ];

  it("marks the active tab", () => {
    render(<FilterTabs tabs={tabs} active="checked_in" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Checked in" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onChange with the clicked tab key", () => {
    const onChange = vi.fn();
    render(<FilterTabs tabs={tabs} active="all" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Checked in" }));

    expect(onChange).toHaveBeenCalledWith("checked_in");
  });

  it("renders counts when given", () => {
    render(<FilterTabs tabs={tabs} active="all" onChange={() => {}} counts={{ all: 34, checked_in: 7 }} />);

    expect(screen.getByRole("button", { name: "All (34)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Checked in (7)" })).toBeTruthy();
  });
});
