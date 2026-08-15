// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Pagination } from "@/shared/components/table-pagination";

afterEach(() => {
  cleanup();
});

describe("Pagination", () => {
  it("renders the correct range for page 1 of 34 over 15/page", () => {
    render(<Pagination page={1} pageSize={15} total={34} onPageChange={() => {}} />);

    expect(screen.getByText("1–15 of 34")).toBeTruthy();
  });

  it("disables Prev on page 1", () => {
    render(<Pagination page={1} pageSize={15} total={34} onPageChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true);
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={3} pageSize={15} total={34} onPageChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  });

  it("calls onPageChange with the next page", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={15} total={34} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with the previous page", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={15} total={34} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("renders nothing when there is only one page", () => {
    const { container } = render(<Pagination page={1} pageSize={15} total={12} onPageChange={() => {}} />);

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when there are no rows", () => {
    const { container } = render(<Pagination page={1} pageSize={15} total={0} onPageChange={() => {}} />);

    expect(container.innerHTML).toBe("");
  });
});
