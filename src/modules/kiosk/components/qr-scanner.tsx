"use client";

import { useEffect, useRef, useCallback } from "react";

interface QrScannerProps {
  onScan: (token: string) => void;
  active: boolean;
  onError?: (message: string) => void;
}

export function QrScanner({ onScan, active, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<InstanceType<typeof import("html5-qrcode").Html5Qrcode> | null>(null);
  const scanningRef = useRef(false);

  // The camera outlives the caller's renders, so the handlers are held in refs
  // rather than listed as effect dependencies. KioskScannerView passes a fresh
  // pair every render, and with them in the deps the effect stopped and
  // restarted the camera on each one — once per keystroke in the manual field,
  // once per scan result, and again when the result cleared three seconds on.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  });

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scanningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Scanner may already be stopped
      }
      scanningRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      if (!active || !containerRef.current) return;

      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const containerId = containerRef.current.id;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!cancelled) onScanRef.current(decodedText);
          },
          () => {
            // No code detected this frame — expected, not an error
          },
        );
        if (!cancelled) scanningRef.current = true;
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current?.(err instanceof Error ? err.message : "Camera unavailable. Use manual input below.");
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active, stopScanner]);

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-border">
      <style>{`
        #qr-reader-container video {
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
        }
        #qr-reader-container .scan-region-highlight {
          display: none !important;
        }
        #qr-reader-container img[alt="Info icon"] {
          display: none !important;
        }
      `}</style>
      <div ref={containerRef} id="qr-reader-container" className="w-full" />
      {active && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-[140px] w-[140px] rounded-xl border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
        </div>
      )}
    </div>
  );
}
