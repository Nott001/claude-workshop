// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { Toast } from "@/shared/components/toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("Toast", () => {
  it("hides itself and reports closing once the duration elapses", () => {
    const onClose = vi.fn();
    render(<Toast title="Saved" description="All good." onClose={onClose} duration={3000} />);

    expect(screen.getByText("Saved")).toBeTruthy();

    advance(3000);

    expect(screen.queryByText("Saved")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on schedule even when the parent re-renders with a new handler", () => {
    const onClose = vi.fn();
    // Reproduces what three of the four call sites do: a fresh arrow every
    // render. When the countdown depended on this identity, each re-render
    // restarted it and the message never went away.
    const { rerender } = render(<Toast title="Saved" onClose={() => onClose()} duration={3000} />);

    for (let elapsed = 0; elapsed < 3000; elapsed += 500) {
      advance(500);
      rerender(<Toast title="Saved" onClose={() => onClose()} duration={3000} />);
    }

    expect(screen.queryByText("Saved")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives a replacement message its own full countdown", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Toast title="First" onClose={onClose} duration={3000} />);

    advance(2000);
    rerender(<Toast title="Second" onClose={onClose} duration={3000} />);

    // 1000ms remained on the first message's timer; the second must not inherit it.
    advance(1000);
    expect(screen.getByText("Second")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    advance(2000);
    expect(screen.queryByText("Second")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a new message raised after an earlier one had closed", () => {
    const { rerender } = render(<Toast title="First" duration={3000} />);

    advance(3000);
    expect(screen.queryByText("First")).toBeNull();

    rerender(<Toast title="Second" duration={3000} />);

    // The instance stays mounted between the two, so re-showing is the
    // component's job rather than the caller's.
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("survives a caller that passes no close handler", () => {
    render(<Toast title="Created" duration={3000} />);

    expect(() => advance(3000)).not.toThrow();
    expect(screen.queryByText("Created")).toBeNull();
  });
});
