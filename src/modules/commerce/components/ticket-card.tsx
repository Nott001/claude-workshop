"use client";

import Link from "next/link";
import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { formatEventPrice, formatVenue } from "@/shared/lib/event-format";
import { useTicketCard } from "@/modules/commerce/lib/use-ticket-card";
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
  const { qrUrl, qrLoading, payment } = useTicketCard(ticket.payment_id);

  const venue = formatVenue(ticket.EVENTS.venue_name, ticket.EVENTS.venue_address);
  const price = formatEventPrice(ticket.EVENTS.price, ticket.EVENTS.currency);

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
          <h2 className="mt-2 text-lg font-bold text-white">{ticket.EVENTS.title}</h2>
        </div>

        <div className="flex-1 px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[20px] text-brand">calendar_today</span>
              <span className="text-sm text-fg">{formatEventDate(ticket.EVENTS.event_date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[20px] text-brand">schedule</span>
              <span className="text-sm text-fg">
                {formatTime(ticket.EVENTS.start_time)} &ndash; {formatTime(ticket.EVENTS.end_time)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[20px] text-brand">location_on</span>
              <span className="text-sm text-fg">{venue}</span>
            </div>
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
        {qrLoading ? (
          <div className="grid size-44 place-items-center">
            <span className="material-symbols-rounded animate-pulse text-5xl text-muted-foreground/50">qr_code</span>
          </div>
        ) : qrUrl ? (
          <img src={qrUrl} alt="QR Code" className="size-44 rounded-lg" />
        ) : (
          <div className="grid size-44 place-items-center rounded-lg bg-surface">
            <span className="text-sm text-muted-foreground">No QR</span>
          </div>
        )}
      </div>
    </div>
  );
}
