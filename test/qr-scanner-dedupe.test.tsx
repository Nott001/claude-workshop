// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { QrScanner } from "@/modules/kiosk/components/qr-scanner";

type SuccessCb = (text: string) => void;

const { startMock, stopMock } = vi.hoisted(() => ({
  startMock: vi.fn().mockResolvedValue(undefined),
  stopMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn().mockImplementation(function (this: { start: typeof startMock; stop: typeof stopMock }) {
    this.start = startMock;
    this.stop = stopMock;
  }),
}));

// Capture the success callback the component registers with html5-qrcode so a
// test can replay decoded frames the way the library does.
let successCb: SuccessCb | undefined;
startMock.mockImplementation((_cam: unknown, _cfg: unknown, onSuccess: SuccessCb) => {
  successCb = onSuccess;
  return Promise.resolve();
});

async function fireDecoded(text: string) {
  await act(async () => {
    await Promise.resolve();
    successCb?.(text);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  successCb = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QrScanner dedupe", () => {
  it("normalizes decoded tokens before dedupe and forwarding", async () => {
    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} active />);

    await act(async () => {
      await Promise.resolve(); // let startScanner import and buffer a frame
    });

    await fireDecoded(" 7AB2C9  ");
    await fireDecoded("7ab2c9"); // same code, different casing — no refire
    await fireDecoded(" 1A2B3C");

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenNthCalledWith(1, "7ab2c9");
    expect(onScan).toHaveBeenNthCalledWith(2, "1a2b3c");
  });

  it("forwards each distinct decoded token only once", async () => {
    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} active />);

    await act(async () => {
      await Promise.resolve(); // let startScanner import and buffer a frame
    });

    await fireDecoded("tok-a");
    await fireDecoded("tok-a");
    await fireDecoded("tok-a");
    await fireDecoded("tok-b");
    await fireDecoded("tok-b");

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenNthCalledWith(1, "tok-a");
    expect(onScan).toHaveBeenNthCalledWith(2, "tok-b");
  });

  it("allows the same token again after the scanner restarts once the cooldown elapses", async () => {
    vi.useFakeTimers();
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    await fireDecoded("tok-a");
    await fireDecoded("tok-a");

    rerender(<QrScanner onScan={onScan} active={false} />);
    rerender(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    // A restart is a fresh scan session, but the gate still holds the previous
    // token for the cooldown so a still-in-frame QR cannot re-trigger.
    await fireDecoded("tok-a");
    expect(onScan).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600);
    await fireDecoded("tok-a");

    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it("does not restart the camera when the parent re-renders", async () => {
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    rerender(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it("pauses without tearing the camera down, and resume accepts a new token", async () => {
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    await fireDecoded("tok-a");
    expect(onScan).toHaveBeenCalledTimes(1);

    rerender(<QrScanner onScan={onScan} active paused />);
    await act(async () => {
      await Promise.resolve();
    });

    // While a card is shown the same QR stays in frame; nothing may fire.
    await fireDecoded("tok-a");
    await fireDecoded("tok-b");
    expect(onScan).toHaveBeenCalledTimes(1);

    // Pausing touched neither the camera lifecycle nor the session.
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(stopMock).not.toHaveBeenCalled();

    rerender(<QrScanner onScan={onScan} active paused={false} />);
    await act(async () => {
      await Promise.resolve();
    });

    // A held QR must not re-trigger; a genuinely new one may.
    await fireDecoded("tok-a");
    await fireDecoded("tok-c");
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenNthCalledWith(2, "tok-c");
  });

  it("accepts the same token again after the camera lifecycle restarts once the cooldown elapses", async () => {
    vi.useFakeTimers();
    const onScan = vi.fn();
    const { rerender } = render(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    await fireDecoded("tok-a");

    rerender(<QrScanner onScan={onScan} active={false} />);
    rerender(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    await fireDecoded("tok-a");
    expect(onScan).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600);
    await fireDecoded("tok-a");

    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it("stops the new camera even when the previous stop is still resolving", async () => {
    const onScan = vi.fn();
    const slowStop = new Promise<void>(() => {});
    stopMock.mockReturnValueOnce(slowStop);

    const { rerender, unmount } = render(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });

    // The stop starts but stays pending while a restart begins.
    rerender(<QrScanner onScan={onScan} active={false} />);
    rerender(<QrScanner onScan={onScan} active />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(startMock).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    // The new camera was stopped even though the first stop never settled.
    expect(stopMock).toHaveBeenCalledTimes(2);
  });
});
