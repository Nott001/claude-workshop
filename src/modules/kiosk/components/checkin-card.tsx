"use client";

import { Badge } from "@/shared/components/badge";
import type { TicketPreview } from "@/modules/kiosk/lib/checkin";

export type CheckinCardPhase = "preview" | "checking" | "confirmed" | "failed";

interface CheckinCardProps {
  preview: TicketPreview;
  phase: CheckinCardPhase;
  checkedInAt?: string;
  failureReason?: string;
  onConfirm: () => void;
  onClear: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StatusBadge({ preview, confirmed }: { preview: TicketPreview; confirmed: boolean }) {
  if (confirmed || preview.status === "checked_in") return <Badge variant="success">Checked in</Badge>;
  if (preview.status === "cancelled") return <Badge variant="error">Cancelled</Badge>;
  return <Badge>Registered</Badge>;
}

export function CheckinCard({ preview, phase, checkedInAt, failureReason, onConfirm, onClear }: CheckinCardProps) {
  const canCheckIn = preview.status === "issued" && phase !== "checking" && phase !== "confirmed";
  const disabledLabel =
    preview.status === "checked_in" ? "Already checked in" : preview.status === "cancelled" ? "Ticket cancelled" : "Check In";

  return (
    <div className="mt-6 w-full rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
          {getInitials(preview.attendee.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{preview.attendee.full_name}</p>
          <p className="truncate text-xs text-muted-fg">{preview.attendee.email}</p>
        </div>
        <StatusBadge preview={preview} confirmed={phase === "confirmed"} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-muted-fg">QR token</span>
          <span className="truncate font-mono text-xs text-fg">{preview.qr_token}</span>
        </div>
        {phase === "confirmed" && checkedInAt && (
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-muted-fg">Checked in</span>
            <span className="text-xs text-fg">{checkedInAt}</span>
          </div>
        )}
      </div>

      {phase === "failed" && failureReason && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs text-error">
          <span className="material-symbols-rounded mt-0.5 text-[16px]">error</span>
          <span>{failureReason}</span>
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          onClick={onConfirm}
          disabled={!canCheckIn}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-100 ${
            phase === "confirmed"
              ? "bg-success/10 text-success"
              : canCheckIn
                ? "bg-brand text-white hover:bg-brand/90"
                : "bg-muted text-muted-fg"
          }`}
        >
          {phase === "checking" ? (
            <span className="material-symbols-rounded animate-spin text-[18px]">progress_activity</span>
          ) : phase === "confirmed" ? (
            <span className="material-symbols-rounded text-[18px]">check_circle</span>
          ) : canCheckIn ? (
            <span className="material-symbols-rounded text-[18px]">check_circle</span>
          ) : (
            <span className="material-symbols-rounded text-[18px]">block</span>
          )}
          {phase === "checking"
            ? "Checking..."
            : phase === "confirmed"
              ? "Checked in"
              : canCheckIn
                ? "Check In"
                : disabledLabel}
        </button>
        <button
          onClick={onClear}
          disabled={phase === "checking"}
          className="flex h-11 w-24 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-muted-fg transition hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </div>
  );
}
