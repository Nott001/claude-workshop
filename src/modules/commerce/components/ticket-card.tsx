"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { formatEventPrice, formatVenue } from "@/shared/lib/event-format";
import { renderQrSvg } from "@/shared/integrations/qr/svg";
import type { Ticket } from "@/modules/commerce/lib/use-tickets";

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

export function TicketCard({ ticket }: { ticket: Ticket }) {
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

  // Nullable: PostgREST returns null for the embed if the row is gone. The old
  // code read straight through it, which threw rather than degrading.
  const event = ticket.EVENT;
  const payment = ticket.PAYMENT;
  const venue = formatVenue(event?.venue_name, event?.venue_address);
  const price = formatEventPrice(event?.price, event?.currency);

  const paidTime = payment?.paid_at
    ? new Date(payment.paid_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-1 flex-col">
        <div className="bg-gradient-to-r from-[#3db9ee] to-[#29B6F6] px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="material-symbols-rounded text-[14px]">confirmation_number</span>
              Ticket
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ticketStatusStyle(ticket.status)}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {ticketStatusLabel(ticket.status)}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-white">{event?.title ?? "Event unavailable"}</h2>
        </div>

        <div className="flex-1 px-6 py-5">
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

          <div className="mt-4 flex items-center gap-3">
            <Link
              href={`/events/${ticket.event_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand/80"
            >
              Go to event
              <span className="material-symbols-rounded text-[14px]">arrow_forward</span>
            </Link>
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Payment #{ticket.payment_id}</span>
              <span>Issued {new Date(ticket.issued_at).toLocaleDateString()}</span>
              {paidTime && <span>Paid {paidTime}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden w-px self-stretch bg-[linear-gradient(to_bottom,transparent_8px,_#d0d5dd_8px,_#d0d5dd_12px,transparent_12px)] bg-[length:1px_20px] sm:block" />

      <div className="flex w-56 shrink-0 items-center justify-center border-l border-dashed border-border bg-muted p-6">
        {qrSvg ? (
          // The markup is produced locally by the qrcode library from this
          // ticket's own token, never from anything a user supplied.
          <div
            className="size-44 overflow-hidden rounded-lg [&>svg]:size-full"
            role="img"
            aria-label="Ticket QR code"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : !qrFailed ? (
          <div className="grid size-44 place-items-center">
            <span className="material-symbols-rounded animate-pulse text-5xl text-muted-foreground/50">qr_code</span>
          </div>
        ) : (
          <div className="grid size-44 place-items-center rounded-lg bg-surface">
            <span className="text-sm text-muted-foreground">No QR</span>
          </div>
        )}
      </div>
    </div>
  );
}
