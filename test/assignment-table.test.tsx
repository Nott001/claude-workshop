// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AssignmentTable, type AssignmentRow } from "@/modules/events/components/assignment-table";

const noop = vi.fn();

function renderTable(props: Partial<React.ComponentProps<typeof AssignmentTable>> = {}) {
  const assigned: AssignmentRow[] = [
    { id: 1, name: "Fay Facilitator", detail: "fay@example.com" },
    { id: 2, name: "Sam Speaker" },
  ];
  const candidates: AssignmentRow[] = [{ id: 3, name: "Pip Presenter", detail: "pip@example.com" }];
  return render(
    <AssignmentTable
      assigned={assigned}
      candidates={candidates}
      selectedId=""
      onSelect={noop}
      onAdd={noop}
      onRemove={noop}
      addButtonLabel="Assign"
      candidatePlaceholder="Select a person..."
      emptyLabel="Nobody assigned."
      allAssignedLabel="Everyone is assigned."
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("AssignmentTable", () => {
  it("lists assigned people with their details and a remove action", () => {
    renderTable();

    expect(screen.getByText("Fay Facilitator")).toBeTruthy();
    expect(screen.getByText("fay@example.com")).toBeTruthy();
    expect(screen.getByText("Sam Speaker")).toBeTruthy();

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);
    expect(noop).toHaveBeenCalledWith(1);
  });

  it("offers candidates in the add row and calls onAdd with the pick", () => {
    const onAdd = vi.fn();
    const result = renderTable({ onAdd });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "3" } });
    result.rerender(
      <AssignmentTable
        assigned={[
          { id: 1, name: "Fay Facilitator", detail: "fay@example.com" },
          { id: 2, name: "Sam Speaker" },
        ]}
        candidates={[{ id: 3, name: "Pip Presenter", detail: "pip@example.com" }]}
        selectedId="3"
        onSelect={noop}
        onAdd={onAdd}
        onRemove={noop}
        addButtonLabel="Assign"
        candidatePlaceholder="Select a person..."
        emptyLabel="Nobody assigned."
        allAssignedLabel="Everyone is assigned."
      />,
    );

    const addButton = screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalled();
  });

  it("disables Add until a candidate is selected", () => {
    renderTable();

    const addButton = screen.getByRole("button", { name: "Assign" }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  it("shows the empty label when nothing is assigned", () => {
    renderTable({ assigned: [], candidates: [{ id: 3, name: "Pip" }] });

    expect(screen.getByText("Nobody assigned.")).toBeTruthy();
  });

  it("shows the all-assigned label once no candidates remain", () => {
    renderTable({ candidates: [] });

    expect(screen.getByText("Everyone is assigned.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows the loading placeholder instead of the roster while loading", () => {
    renderTable({ loading: true });

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("loads more candidates when the roster is paginated", () => {
    const onLoadMore = vi.fn();
    renderTable({ candidatesHasMore: true, onLoadMoreCandidates: onLoadMore });

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
