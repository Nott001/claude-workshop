"use client";

import { useEffect, useRef } from "react";

interface QrScannerProps {
  onScan: (token: string) => void;
  active: boolean;
  paused?: boolean;
  onError?: (message: string) => void;
}

// `active` owns the camera lifecycle (start, error). `paused` only stops
// decoded tokens reaching `onScan`, so showing a card does not tear the camera
// down and re-acquire getUserMedia a few hundred ms later. A session counter
// keeps one lifecycle's async start/stop from clobbering the next camera's
// state when the two overlap.
export function QrScanner({ onScan, active, paused = false, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<InstanceType<typeof import("html5-qrcode").Html5Qrcode> | null>(null);
  const sessionRef = useRef(0);
  // The library refires the same decoded text ~10x/sec while a QR stays in
  // frame. Mirrors keep the effect and the camera stable; identical-token
  // dedupe stops the spam at its source.
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const pausedRef = useRef(paused);
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!active) return;

    const session = ++sessionRef.current;
    let mounted = true;

    async function startScanner() {
      if (!containerRef.current) return;

      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted || session !== sessionRef.current) return;

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
            if (!mounted || session !== sessionRef.current) return;
            if (pausedRef.current) return;
            // Decoded text mirrors what is printed on the QR; typing is
            // case-insensitive, so dedupe and forwarding agree with the server
            // on one canonical form.
            const token = decodedText.trim().toLowerCase();
            if (token === lastTokenRef.current) return;
            lastTokenRef.current = token;
            onScanRef.current(token);
          },
          () => {
            // No code detected this frame — expected, not an error
          },
        );
      } catch (err) {
        if (!mounted || session !== sessionRef.current) return;
        onErrorRef.current?.(err instanceof Error ? err.message : "Camera unavailable. Use manual input below.");
      }
    }

    startScanner();

    return () => {
      // Bump the session so an in-flight start for this lifecycle cannot touch
      // the next camera's refs, and stop the exact instance this effect owns.
      mounted = false;
      sessionRef.current += 1;
      lastTokenRef.current = null;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        void scanner.stop().catch(() => {
          // Scanner may already be stopped
        });
      }
    };
  }, [active]);

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
      {active && !paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-[140px] w-[140px] rounded-xl border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
        </div>
      )}
    </div>
  );
}
