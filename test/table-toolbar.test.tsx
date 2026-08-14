// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TableSearch, TableToolbar } from "@/shared/components/table-toolbar";

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

describe("TableToolbar", () => {
  it("renders the search above the filter children", () => {
    const { container } = render(
      <TableToolbar search={{ value: "", onChange: () => {}, placeholder: "Search rows..." }}>
        <button type="button">Filter</button>
      </TableToolbar>,
    );

    const input = container.querySelector("input");
    const filter = screen.getByRole("button", { name: "Filter" });

    expect(input).toBeTruthy();
    // The search input precedes the filter controls in document order.
    expect(input!.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("passes the search value and onChange through", () => {
    const onChange = vi.fn();
    render(<TableToolbar search={{ value: "ada", onChange, placeholder: "Search rows..." }} />);

    expect(screen.getByPlaceholderText("Search rows...").getAttribute("value")).toBe("ada");

    fireEvent.change(screen.getByPlaceholderText("Search rows..."), { target: { value: "grace" } });

    expect(onChange).toHaveBeenCalledWith("grace");
  });

  it("renders without filter children", () => {
    render(<TableToolbar search={{ value: "", onChange: () => {}, placeholder: "Search rows..." }} />);

    expect(screen.getByPlaceholderText("Search rows...")).toBeTruthy();
  });
});
