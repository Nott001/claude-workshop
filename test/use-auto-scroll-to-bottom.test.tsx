// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, act } from "@testing-library/react";
import { useAutoScrollToBottom } from "@/modules/chat/lib/use-auto-scroll-to-bottom";

function Harness({ items }: { items: string[] }) {
  const { containerRef, bottomRef, forceScroll } = useAutoScrollToBottom(items, true);
  return (
    <div>
      <div ref={containerRef} data-testid="scroller">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
        <div ref={bottomRef} />
      </div>
      <button onClick={forceScroll}>force</button>
    </div>
  );
}

const scrollIntoView = vi.fn();
let container: HTMLElement;

beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, writable: true, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { value: 500, writable: true, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { value: 100, writable: true, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", { value: 0, writable: true, configurable: true });
});

afterEach(() => {
  cleanup();
});

describe("useAutoScrollToBottom", () => {
  it("scrolls to the bottom on the first render and on new items while near the bottom", () => {
    const { rerender } = render(<Harness items={["a"]} />);
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();
    rerender(<Harness items={["a", "b"]} />);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("does not scroll when the reader is far from the bottom", () => {
    const { rerender } = render(<Harness items={["a"]} />);
    scrollIntoView.mockClear();

    container = screen.getByTestId("scroller");
    Object.defineProperty(container, "scrollTop", { value: 300, writable: true });
    fireEvent.scroll(container);

    rerender(<Harness items={["a", "b"]} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("forceScroll scrolls even when the reader is far from the bottom", () => {
    const { rerender } = render(<Harness items={["a"]} />);
    scrollIntoView.mockClear();

    container = screen.getByTestId("scroller");
    Object.defineProperty(container, "scrollTop", { value: 300, writable: true });
    fireEvent.scroll(container);

    act(() => screen.getByText("force").click());
    rerender(<Harness items={["a", "b"]} />);
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
