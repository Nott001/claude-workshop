"use client";

import { useState } from "react";
import type { Event, TicketStatus } from "@/shared/types";
import type { TicketPreview } from "@/modules/kiosk/lib/checkin";
import { QrScanner } from "./qr-scanner";
import { CheckinCard } from "./checkin-card";
import { AttendeesPanel } from "./attendees-panel";

type ScanState =
  | { phase: "idle" }
  | { phase: "looking_up"; token: string }
  | { phase: "preview"; token: string; preview: TicketPreview }
  | { phase: "checking"; token: string; preview: TicketPreview }
  | { phase: "confirmed"; token: string; preview: TicketPreview; checkedInAt: string }
  | { phase: "invalid"; token: string };

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KioskScannerView({ event }: { event: Event }) {
  const [qrInput, setQrInput] = useState("");
  const [scanState, setScanState] = useState<ScanState>({ phase: "idle" });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function lookupToken(token: string) {
    const trimmed = token.trim();
    if (!trimmed) return;
    setScanState({ phase: "looking_up", token: trimmed });
    setQrInput(trimmed);

    try {
      const res = await fetch(`/api/checkin/lookup?qr_token=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setScanState({ phase: "invalid", token: trimmed });
        return;
      }
      const preview = (await res.json()) as TicketPreview;
      setScanState({ phase: "preview", token: trimmed, preview });
    } catch {
      setScanState({ phase: "invalid", token: trimmed });
    }
  }

  async function handleConfirm() {
    if (scanState.phase !== "preview") return;
    const { token, preview } = scanState;
    setScanState({ phase: "checking", token, preview });

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: token }),
      });
      let data: { status: string; reason?: string };
      if (res.ok) {
        data = await res.json();
      } else {
        data = { status: "rejected", reason: "invalid" };
      }

      if (data.status === "success") {
        const checkedInAt = formatTime(new Date().toISOString());
        setScanState({ phase: "confirmed", token, preview, checkedInAt });
      } else if (data.status === "duplicate") {
        const updated: TicketPreview = { ...preview, status: "checked_in" as TicketStatus };
        const checkedInAt = updated.checked_in_at ? formatTime(updated.checked_in_at) : formatTime(new Date().toISOString());
        setScanState({ phase: "confirmed", token, preview: updated, checkedInAt });
      } else {
        // Rejected (cancelled) or anything unexpected: reflect the ticket's
        // non-checkinable state on the card so the operator sees why.
        const updated = data.reason === "cancelled" ? { ...preview, status: "cancelled" as TicketStatus } : preview;
        setScanState({ phase: "preview", token, preview: updated });
      }
    } catch {
      setScanState({ phase: "preview", token, preview });
    }
  }

  function handleClear() {
    setScanState({ phase: "idle" });
    setQrInput("");
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (scanState.phase === "idle") void lookupToken(qrInput);
  }

  const cardActive = scanState.phase !== "idle";
  const lookingUp = scanState.phase === "looking_up";

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col items-center px-6 py-8 lg:border-r lg:border-border">
        <div className="flex w-full max-w-lg flex-col items-center">
          <span className="material-symbols-rounded mb-3 text-[40px] text-brand">qr_code_scanner</span>
          <p className="mb-1 text-sm font-semibold text-fg">Align the participant&apos;s QR code within the frame</p>
          <p className="mb-6 text-center text-xs text-muted-fg">
            Scan to preview the attendee, then confirm to record their check-in.
          </p>

          {!cameraActive && !cameraError && scanState.phase === "idle" && (
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

          {cameraError && scanState.phase === "idle" && (
            <div className="mb-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-error/30 bg-error/10 text-sm text-error">
              <span className="material-symbols-rounded text-[18px]">videocam_off</span>
              {cameraError}
            </div>
          )}

          {cameraActive && (
            // Camera pauses while a card is shown so a held QR cannot re-trigger
            // lookups or check-ins; it resumes when the operator clears the card.
            <QrScanner
              onScan={(token) => {
                if (scanState.phase === "idle") void lookupToken(token);
              }}
              active={cameraActive && scanState.phase === "idle"}
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
                disabled={cardActive}
                className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 text-sm text-fg placeholder-muted-fg outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/20 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={cardActive || !qrInput.trim()}
                className="flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {lookingUp ? (
                  <span className="material-symbols-rounded animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-rounded text-[18px]">person_search</span>
                )}
                {lookingUp ? "Finding..." : "Find Attendee"}
              </button>
            </div>
          </form>

          {scanState.phase === "looking_up" && (
            <div className="mt-6 flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <span className="material-symbols-rounded animate-spin text-[20px] text-brand">progress_activity</span>
              <span className="truncate font-mono text-xs text-fg">{scanState.token}</span>
            </div>
          )}

          {scanState.phase === "invalid" && (
            <div className="mt-6 flex w-full flex-col gap-3 rounded-xl border border-error/20 bg-error/10 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="material-symbols-rounded mt-0.5 text-[20px] text-error">cancel</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">Invalid ticket</p>
                  <p className="truncate font-mono text-xs text-muted-fg">{scanState.token}</p>
                  <p className="text-xs text-muted-fg">This QR code could not be validated for this event.</p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-muted-fg transition hover:text-fg"
              >
                Done
              </button>
            </div>
          )}

          {(scanState.phase === "preview" || scanState.phase === "checking" || scanState.phase === "confirmed") && (
            <CheckinCard
              preview={scanState.preview}
              phase={scanState.phase === "checking" ? "checking" : scanState.phase === "confirmed" ? "confirmed" : "preview"}
              checkedInAt={scanState.phase === "confirmed" ? scanState.checkedInAt : undefined}
              onConfirm={() => void handleConfirm()}
              onClear={handleClear}
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <AttendeesPanel eventId={String(event.id)} />
      </div>
    </div>
  );
}
