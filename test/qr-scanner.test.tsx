// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { QrScanner } from "@/modules/kiosk/components/qr-scanner";

const { start, stop } = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn(function (this: { start: typeof start; stop: typeof stop }) {
    this.start = start;
    this.stop = stop;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("QrScanner camera lifetime", () => {
  it("keeps one camera running while the caller re-renders around it", async () => {
    // KioskScannerView rebuilds both handlers on every render — a keystroke in
    // the manual field, a scan result, the timer that clears it. None of that
    // is a reason to drop the video stream and ask for it again.
    const { rerender } = render(<QrScanner active onScan={() => {}} onError={() => {}} />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 5; i++) {
      rerender(<QrScanner active onScan={() => {}} onError={() => {}} />);
    }

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  });

  it("scans with the handler the caller holds now, not the one it mounted with", async () => {
    const first = vi.fn();
    const latest = vi.fn();

    const { rerender } = render(<QrScanner active onScan={first} />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));

    rerender(<QrScanner active onScan={latest} />);

    // The success callback html5-qrcode was handed at start time.
    start.mock.calls[0][2]("qr-token");

    expect(latest).toHaveBeenCalledWith("qr-token");
    expect(first).not.toHaveBeenCalled();
  });

  it("reports a camera that will not open, through the caller's current handler", async () => {
    start.mockRejectedValueOnce(new Error("Permission denied"));
    const onError = vi.fn();

    render(<QrScanner active onScan={() => {}} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Permission denied"));
  });

  it("stops the camera when the caller turns it off", async () => {
    const { rerender } = render(<QrScanner active onScan={() => {}} />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));

    rerender(<QrScanner active={false} onScan={() => {}} />);

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });

  it("releases the camera on unmount", async () => {
    const { unmount } = render(<QrScanner active onScan={() => {}} />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));

    unmount();

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });
});
