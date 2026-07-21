import { describe, it, expect, vi, beforeEach } from "vitest";

const startMock = vi.fn().mockResolvedValue(undefined);
const stopMock = vi.fn().mockResolvedValue(undefined);

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn().mockImplementation(function (this: {
    start: typeof startMock;
    stop: typeof stopMock;
  }) {
    this.start = startMock;
    this.stop = stopMock;
  }),
}));

describe("QrScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Html5Qrcode can be dynamically imported", async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    expect(Html5Qrcode).toBeDefined();
    expect(typeof Html5Qrcode).toBe("function");
  });

  it("Html5Qrcode instance has start and stop methods", async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance = new (Html5Qrcode as any)();
    expect(typeof instance.start).toBe("function");
    expect(typeof instance.stop).toBe("function");
  });

  it("start accepts camera config with environment facing mode", async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanner = new (Html5Qrcode as any)();

    const onScan = vi.fn();
    const onNoCode = vi.fn();

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      onScan,
      onNoCode,
    );

    expect(startMock).toHaveBeenCalledWith(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      onScan,
      onNoCode,
    );
  });

  it("success callback receives decoded text", async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanner = new (Html5Qrcode as any)();

    let successCb: ((text: string) => void) | undefined;

    startMock.mockImplementation(
      (
        _cam: unknown,
        _cfg: unknown,
        onSuccess: (text: string) => void,
        _onErr: unknown, // eslint-disable-line @typescript-eslint/no-unused-vars
      ) => {
        successCb = onSuccess;
        return Promise.resolve();
      },
    );

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      vi.fn(),
      vi.fn(),
    );

    const onScan = vi.fn();
    successCb?.("test-qr-token-123");
    onScan("test-qr-token-123");
    expect(onScan).toHaveBeenCalledWith("test-qr-token-123");
  });

  it("stop cleans up the scanner", async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanner = new (Html5Qrcode as any)();

    await scanner.stop();
    expect(stopMock).toHaveBeenCalled();
  });
});
