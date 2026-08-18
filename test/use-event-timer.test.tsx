// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useEventTimer } from "@/shared/lib/use-event-timer";

const EVENT_DATE = "2026-09-01";
const START_TIME = "09:00:00";
const END_TIME = "10:00:00";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T09:30:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useEventTimer", () => {
  it("tracks elapsed and remaining while the session is underway", () => {
    const { result } = renderHook(() => useEventTimer(EVENT_DATE, START_TIME, END_TIME));

    expect(result.current.elapsed).toBe("00:30:00");
    expect(result.current.remaining).toBe("00:30:00");
  });

  it('holds "00:00:00" until the session opens', () => {
    vi.setSystemTime(new Date("2026-09-01T08:30:00"));

    const { result } = renderHook(() => useEventTimer(EVENT_DATE, START_TIME, END_TIME));

    expect(result.current.elapsed).toBe("00:00:00");
    expect(result.current.remaining).toBe("01:30:00");
  });

  it("leaves remaining indeterminate when there is no end time", () => {
    const { result } = renderHook(() => useEventTimer(EVENT_DATE, START_TIME, ""));

    expect(result.current.elapsed).toBe("00:30:00");
    expect(result.current.remaining).toBe("--:--:--");
  });

  it("clamps elapsed at the full session duration and stops the interval once ended", () => {
    vi.setSystemTime(new Date("2026-09-01T09:59:00"));

    const { result } = renderHook(() => useEventTimer(EVENT_DATE, START_TIME, END_TIME));

    act(() => vi.advanceTimersByTime(120_000));

    expect(result.current.elapsed).toBe("01:00:00");
    expect(result.current.remaining).toBe("00:00:00");
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.elapsed).toBe("01:00:00");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never schedules an interval when the session already ended at mount", () => {
    vi.setSystemTime(new Date("2026-09-01T11:00:00"));

    const { result } = renderHook(() => useEventTimer(EVENT_DATE, START_TIME, END_TIME));

    expect(result.current.elapsed).toBe("01:00:00");
    expect(result.current.remaining).toBe("00:00:00");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clamps a malformed row whose end precedes its start to a zero duration", () => {
    vi.setSystemTime(new Date("2026-09-01T11:00:00"));

    const { result } = renderHook(() => useEventTimer(EVENT_DATE, "10:00:00", "09:00:00"));

    expect(result.current.elapsed).toBe("00:00:00");
    expect(result.current.remaining).toBe("00:00:00");
    expect(vi.getTimerCount()).toBe(0);
  });
});
