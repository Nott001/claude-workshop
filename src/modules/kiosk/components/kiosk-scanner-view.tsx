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
  | { phase: "confirm_failed"; token: string; preview: TicketPreview; reason: string }
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
    // The manual path types free-form text; the scan path is already
    // canonicalized by QrScanner, but one normalization here keeps every
    // input in the single form the server stores.
    const normalized = token.trim().toLowerCase();
    if (!normalized) return;
    setScanState({ phase: "looking_up", token: normalized });
    setQrInput(normalized);

    try {
      const res = await fetch(`/api/checkin/lookup?qr_token=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        setScanState({ phase: "invalid", token: normalized });
        return;
      }
      const preview = (await res.json()) as TicketPreview;
      setScanState({ phase: "preview", token: normalized, preview });
    } catch {
      setScanState({ phase: "invalid", token: normalized });
    }
  }

  async function handleConfirm() {
    if (scanState.phase !== "preview" && scanState.phase !== "confirm_failed") return;
    const { token, preview } = scanState;
    setScanState({ phase: "checking", token, preview });

    let res: Response;
    try {
      res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: token }),
      });
    } catch {
      setScanState({
        phase: "confirm_failed",
        token,
        preview,
        reason: "Could not reach the server. Check the network and try again.",
      });
      return;
    }

    if (!res.ok) {
      setScanState({
        phase: "confirm_failed",
        token,
        preview,
        reason: "The check-in could not be recorded. Try again.",
      });
      return;
    }

    const data = (await res.json()) as {
      status: string;
      reason?: string;
      ticket?: { checked_in_at?: string | null };
    };

    if (data.status === "success") {
      const checkedInAt = formatTime(new Date().toISOString());
      setScanState({ phase: "confirmed", token, preview, checkedInAt });
      return;
    }

    if (data.status === "duplicate") {
      // Someone else checked this ticket in between lookup and confirm. The
      // server row is the source of truth for when; synthesizing "now" would
      // put the wrong time on an already-checked-in ticket.
      const ticketTime = data.ticket?.checked_in_at ?? preview.checked_in_at;
      const checkedInAt = formatTime(ticketTime ?? new Date().toISOString());
      const updated: TicketPreview = {
        ...preview,
        status: "checked_in" as TicketStatus,
        checked_in_at: ticketTime,
      };
      setScanState({ phase: "confirmed", token, preview: updated, checkedInAt });
      return;
    }

    if (data.status === "rejected" && data.reason === "cancelled") {
      // Ticket was revoked between lookup and confirm: reflect it on the card.
      setScanState({ phase: "preview", token, preview: { ...preview, status: "cancelled" as TicketStatus } });
      return;
    }

    setScanState({
      phase: "confirm_failed",
      token,
      preview,
      reason: "This ticket is not in a state that can be checked in.",
    });
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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* The kiosk locks to the viewport, so this column scrolls itself rather
          than pushing the attendee panel off the bottom of a tablet. */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 lg:border-r lg:border-border">
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
            // The camera stays up while a card is shown — pausing drops decoded
            // tokens instead of tearing down getUserMedia and reading it back in.
            <QrScanner
              onScan={(token) => void lookupToken(token)}
              active={cameraActive}
              paused={cardActive}
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

          {(scanState.phase === "preview" ||
            scanState.phase === "checking" ||
            scanState.phase === "confirmed" ||
            scanState.phase === "confirm_failed") && (
            <CheckinCard
              preview={scanState.preview}
              phase={
                scanState.phase === "checking"
                  ? "checking"
                  : scanState.phase === "confirmed"
                    ? "confirmed"
                    : scanState.phase === "confirm_failed"
                      ? "failed"
                      : "preview"
              }
              failureReason={scanState.phase === "confirm_failed" ? scanState.reason : undefined}
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
