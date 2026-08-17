"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { formatEventPrice, formatVenue } from "@/shared/lib/event-format";
import { renderQrSvg } from "@/shared/integrations/qr/svg";
import type { TicketWithEvent } from "@/shared/db/dao/ticket.dao";

function ticketStatusStyle(status: string): string {
  switch (status) {
    case "checked_in":
      return "bg-success/10 text-success";
    case "issued":
      return "bg-info/10 text-info";
    case "cancelled":
      return "bg-muted text-muted-fg";
    default:
      return "bg-surface text-muted-foreground";
  }
}

function ticketStatusLabel(status: string): string {
  switch (status) {
    case "issued":
      return "Registered";
    case "checked_in":
      return "Checked in";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

// The shared formatTime parses clock-time strings from EVENT; a check-in time
// arrives as a full ISO datetime (updated_at), so it needs the Date route.
function formatCheckinTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TicketPass({ ticket }: { ticket: TicketWithEvent }) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderQrSvg(ticket.qr_token)
      .then((svg) => !cancelled && setQrSvg(svg))
      .catch(() => !cancelled && setQrFailed(true));
    return () => {
      cancelled = true;
    };
  }, [ticket.qr_token]);

  const event = ticket.EVENT;
  const venue = formatVenue(event?.venue_name, event?.venue_address);
  const price = formatEventPrice(event?.price, event?.currency);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg px-4 py-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
          <div className="bg-gradient-to-r from-[#3db9ee] to-[#29B6F6] px-6 py-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                <span className="material-symbols-rounded text-[14px]">confirmation_number</span>
                Ticket
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ticketStatusStyle(ticket.status)}`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {ticket.status === "checked_in" && ticket.updated_at
                  ? `Checked in · ${formatCheckinTime(ticket.updated_at)}`
                  : ticketStatusLabel(ticket.status)}
              </span>
            </div>
            <h1 className="mt-3 text-xl font-bold text-white">{event?.title ?? "Event unavailable"}</h1>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-3">
              {event && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-[20px] text-brand">calendar_today</span>
                    <span className="text-sm text-fg">{formatEventDate(event.event_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-rounded text-[20px] text-brand">schedule</span>
                    <span className="text-sm text-fg">
                      {formatTime(event.start_time)} &ndash; {formatTime(event.end_time)}
                    </span>
                  </div>
                </>
              )}
              {venue && (
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded text-[20px] text-brand">location_on</span>
                  <span className="text-sm text-fg">{venue}</span>
                </div>
              )}
              {price && (
                <div className="flex items-center gap-3">
                  <span className="material-symbols-rounded text-[20px] text-brand">payments</span>
                  <span className="text-sm font-semibold text-fg">{price}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* The QR dominates the fold: an entrance scanner reads it from a phone
            held at arm's length, so it gets the center of the viewport, not a
            side column. */}
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8">
          {qrFailed ? (
            <div className="grid size-56 place-items-center rounded-lg bg-muted">
              <span className="text-sm text-muted-foreground">No QR</span>
            </div>
          ) : qrSvg ? (
            <div
              className="size-56 overflow-hidden rounded-lg [&>svg]:size-full"
              role="img"
              aria-label="Ticket QR code"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="grid size-56 place-items-center">
              <span className="material-symbols-rounded animate-pulse text-6xl text-muted-foreground/50">qr_code</span>
            </div>
          )}
          {/* The code stays visible even when the image fails to render — it is
              the fallback credential for anyone whose camera cannot scan. */}
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Check-in code</span>
            <span className="font-mono text-xl font-bold tracking-widest text-fg">{ticket.qr_token}</span>
          </div>
          <p className="text-center text-xs text-muted-fg">Present this QR code at the entrance for check-in.</p>
        </div>

        <div className="mt-5 flex justify-center">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand/80"
          >
            <span className="material-symbols-rounded text-[14px]">arrow_back</span>
            Back to my tickets
          </Link>
        </div>
      </div>
    </div>
  );
}
