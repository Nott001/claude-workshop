"use client";

import { useEffect, useRef, useState } from "react";
import type { Event } from "@/shared/types";
import { QrScanner } from "./qr-scanner";
import { AttendeesPanel } from "./attendees-panel";

interface CheckinResponse {
  status: "success" | "duplicate" | "rejected";
  attendee?: { full_name: string; email: string };
  reason?: string;
}

type ResultKind = "success" | "duplicate" | "rejected" | null;

export function KioskScannerView({ event }: { event: Event }) {
  const [qrInput, setQrInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ResultKind>(null);
  const [resultData, setResultData] = useState<CheckinResponse | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  async function handleCheckin(token: string) {
    if (processing || !token.trim()) return;
    setProcessing(true);
    setQrInput(token);

    let data: CheckinResponse;
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: token.trim() }),
      });
      data = res.ok ? await res.json() : { status: "rejected", reason: "invalid" };
    } catch {
      data = { status: "rejected", reason: "invalid" };
    }

    setResultData(data);
    setResult(data.status === "success" ? "success" : data.status === "duplicate" ? "duplicate" : "rejected");

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setResult(null);
      setResultData(null);
      setQrInput("");
      setProcessing(false);
    }, 3000);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleCheckin(qrInput);
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col items-center px-6 py-8 lg:border-r lg:border-border">
        <div className="flex w-full max-w-lg flex-col items-center">
          <span className="material-symbols-rounded mb-3 text-[40px] text-brand">qr_code_scanner</span>
          <p className="mb-1 text-sm font-semibold text-fg">Align the participant&apos;s QR code within the frame</p>
          <p className="mb-6 text-center text-xs text-muted-fg">To automatically verify attendance and record check-in time.</p>

          {!cameraActive && !cameraError && (
            <button
              onClick={() => {
                setCameraActive(true);
                setCameraError(null);
              }}
              className="mb-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted text-sm font-semibold text-muted-fg transition hover:border-brand hover:text-brand"
            >
              <span className="material-symbols-rounded text-[22px]">photo_camera</span>
              Start Camera Scanner
            </button>
          )}

          {cameraError && (
            <div className="mb-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-error/30 bg-error/10 text-sm text-error">
              <span className="material-symbols-rounded text-[18px]">videocam_off</span>
              {cameraError}
            </div>
          )}

          {cameraActive && (
            <QrScanner
              onScan={handleCheckin}
              active={cameraActive}
              onError={(msg) => {
                setCameraError(msg);
                setCameraActive(false);
              }}
            />
          )}

          <form onSubmit={handleManualSubmit} className="w-full">
            <label htmlFor="qr-input" className="mb-1.5 block text-sm font-medium text-fg">
              Manual check-in
            </label>
            <div className="flex gap-3">
              <input
                id="qr-input"
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Scan or type QR token..."
                disabled={processing}
                className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 text-sm text-fg placeholder-muted-fg outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/20 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={processing || !qrInput.trim()}
                className="flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing ? (
                  <span className="material-symbols-rounded animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-rounded text-[18px]">check_circle</span>
                )}
                {processing ? "Checking..." : "Check In"}
              </button>
            </div>
          </form>

          {result && resultData && (
            <div
              className={`mt-6 flex w-full items-start gap-3 rounded-xl border px-4 py-3 ${
                result === "success"
                  ? "border-success/20 bg-success/10"
                  : result === "duplicate"
                    ? "border-warning/20 bg-warning/10"
                    : "border-error/20 bg-error/10"
              }`}
            >
              <span
                className={`material-symbols-rounded mt-0.5 text-[20px] ${
                  result === "success" ? "text-success" : result === "duplicate" ? "text-warning" : "text-error"
                }`}
              >
                {result === "success" ? "check_circle" : result === "duplicate" ? "warning" : "cancel"}
              </span>
              <div>
                {result === "success" && (
                  <>
                    <p className="text-sm font-semibold text-fg">Checked in</p>
                    <p className="text-sm text-muted-fg">{resultData.attendee?.full_name}</p>
                    <p className="text-xs text-muted-fg">{resultData.attendee?.email}</p>
                  </>
                )}
                {result === "duplicate" && <p className="text-sm font-semibold text-fg">Already checked in</p>}
                {result === "rejected" && (
                  <>
                    <p className="text-sm font-semibold text-fg">
                      {resultData.reason === "cancelled" ? "Ticket cancelled" : "Invalid ticket"}
                    </p>
                    <p className="text-xs text-muted-fg">This QR code could not be validated for this event.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <AttendeesPanel eventId={String(event.id)} />
      </div>
    </div>
  );
}
