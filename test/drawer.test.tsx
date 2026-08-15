// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Drawer } from "@/shared/components/drawer";

afterEach(() => {
  cleanup();
});

function renderDrawer(open: boolean, onOpenChange = vi.fn()) {
  render(
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Attendee details"
      description="Review and manage this attendee."
      footer={<button>Save</button>}
    >
      <p>Ada Lovelace</p>
    </Drawer>,
  );
  return onOpenChange;
}

describe("Drawer", () => {
  it("renders title, description and children when open", () => {
    renderDrawer(true);

    expect(screen.getByText("Attendee details")).toBeTruthy();
    expect(screen.getByText("Review and manage this attendee.")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    renderDrawer(false);

    expect(screen.queryByText("Attendee details")).toBeNull();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("closes on backdrop click", async () => {
    const onOpenChange = renderDrawer(true);

    const backdrop = document.body.querySelector("[data-open]") as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("closes on Escape", async () => {
    const onOpenChange = renderDrawer(true);

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("closes from the header close button", async () => {
    const onOpenChange = renderDrawer(true);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
