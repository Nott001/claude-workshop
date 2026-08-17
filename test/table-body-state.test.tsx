// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { Table, TableHead, TableRow, TableHeadCell, TableBody, TableBodyState } from "@/shared/components/table";

afterEach(() => {
  cleanup();
});

interface HarnessProps {
  ready: boolean;
  loading: boolean;
  busy?: boolean;
  empty?: { icon?: string; title: string; hint?: string };
  rows?: ReactNode;
}

// Two-column table with the stateful body; `busy` is handed to TableBody, the
// rest to TableBodyState, reproducing exactly what every staff table now does.
function renderHarness({ ready, loading, busy, empty, rows }: HarnessProps) {
  return render(
    <Table>
      <TableHead>
        <TableRow>
          <TableHeadCell>Name</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </TableRow>
      </TableHead>
      <TableBody busy={busy}>
        <TableBodyState ready={ready} loading={loading} colSpan={2} empty={empty ?? { title: "Nothing here" }}>
          {rows}
        </TableBodyState>
      </TableBody>
    </Table>,
  );
}

const aRow = (
  <tr>
    <td>Ada</td>
    <td>Checked in</td>
  </tr>
);

describe("TableBodyState", () => {
  it("renders the rows once ready", () => {
    renderHarness({ ready: true, loading: false, rows: aRow });

    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(screen.queryByText("Nothing here")).toBeNull();
  });

  it("keeps stale rows on screen and marks the body busy while a refetch is in flight", () => {
    renderHarness({ ready: true, loading: true, busy: true, rows: aRow });

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    const body = screen.getByText("Ada").closest("tbody");
    expect(body?.getAttribute("aria-busy")).toBe("true");
  });

  it("spans a loading row under a header that stays mounted", () => {
    renderHarness({ ready: false, loading: true });

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(1);
    expect(cells[0].getAttribute("colspan")).toBe("2");
  });

  it("renders the empty state under the header instead of replacing it", () => {
    renderHarness({
      ready: false,
      loading: false,
      empty: { icon: "group", title: "No rows", hint: "Try another term." },
    });

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("No rows")).toBeTruthy();
    expect(screen.getByText("Try another term.")).toBeTruthy();
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(1);
    expect(cells[0].getAttribute("colspan")).toBe("2");
    expect(screen.queryByText("Nothing here")).toBeNull();
  });
});
