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
});

describe("QrScanner dedupe", () => {
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

  it("allows the same token again after the scanner restarts", async () => {
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
});
