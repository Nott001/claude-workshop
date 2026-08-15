// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button, buttonStyles } from "@/shared/components/button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders a native button so the primitive keeps its semantics", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("applies variant and size styles", () => {
    render(
      <Button variant="danger" size="lg">
        Delete
      </Button>,
    );

    const className = screen.getByRole("button", { name: "Delete" }).className;
    expect(className).toContain("bg-error");
    expect(className).toContain("h-10");
  });

  it("resolves a state-dependent className instead of discarding it", () => {
    render(<Button className={(state) => (state.disabled ? "is-off" : "is-on")}>Toggle</Button>);

    expect(screen.getByRole("button", { name: "Toggle" }).className).toContain("is-on");
  });
});

describe("buttonStyles", () => {
  it("produces the same classes the component applies", () => {
    render(
      <Button variant="secondary" size="sm">
        Open
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Open" }).className).toBe(buttonStyles({ variant: "secondary", size: "sm" }));
  });
});
