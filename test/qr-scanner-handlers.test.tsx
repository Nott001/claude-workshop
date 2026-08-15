// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { QrScanner } from "@/modules/kiosk/components/qr-scanner";

/**
 * The camera's own lifecycle — restarts, pausing, dedupe, overlapping stops —
 * is covered by qr-scanner-dedupe.test.tsx. This covers the consequence of
 * holding the callbacks in refs to achieve that: a handler kept out of the
 * effect's dependencies is a handler that can go stale, and these two paths
 * are where that would show.
 */

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

describe("QrScanner handler freshness", () => {
  it("scans with the handler the caller holds now, not the one it mounted with", async () => {
    const first = vi.fn();
    const latest = vi.fn();

    const { rerender } = render(<QrScanner active onScan={first} />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));

    rerender(<QrScanner active onScan={latest} />);

    // The success callback html5-qrcode was handed when the camera started.
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
});
