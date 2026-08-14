// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeadCell,
  TableCell,
  TableEmpty,
  TableContainer,
} from "@/shared/components/table";

afterEach(() => {
  cleanup();
});

describe("TableContainer", () => {
  it("wraps content in the shared card look", () => {
    render(<TableContainer>content</TableContainer>);
    expect(screen.getByText("content").className).toContain("rounded-xl");
  });
});

describe("Table rows", () => {
  it("renders header and body cells with their text", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeadCell>Name</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
            <TableCell>Checked in</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("Checked in")).toBeTruthy();
  });

  it("is not focusable when it has no onClick", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>plain</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("plain").closest("tr")?.getAttribute("tabindex")).toBeNull();
  });

  it("calls onClick on mouse click", () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow onClick={onClick}>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    fireEvent.click(screen.getByText("Ada"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates on Enter and on Space", () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow onClick={onClick}>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const row = screen.getByText("Ada").closest("tr")!;
    expect(row.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe("TableEmpty", () => {
  it("renders the required title and optional hint", () => {
    render(<TableEmpty icon="group" title="No attendees found" hint="Try a different search term." />);

    expect(screen.getByText("No attendees found")).toBeTruthy();
    expect(screen.getByText("Try a different search term.")).toBeTruthy();
  });

  it("renders only the title when no hint is given", () => {
    render(<TableEmpty title="No attendees found" />);

    expect(screen.getByText("No attendees found")).toBeTruthy();
    expect(screen.queryByText(/Try a different/i)).toBeNull();
  });
});
