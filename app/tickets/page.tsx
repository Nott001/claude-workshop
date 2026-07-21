"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { formatEventDate, formatTime } from "@/lib/landing";

interface TicketEvent {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_address: string | null;
  price: number;
  currency: string;
}

interface PaymentInfo {
  status: string;
  paid_at: string | null;
}

interface Ticket {
  payment_id: number;
  qr_token: string;
  status: string;
  issued_at: string;
  PAYMENTS: PaymentInfo | PaymentInfo[];
  EVENTS: TicketEvent;
}

function ticketStatusStyle(status: string): string {
  switch (status) {
    case "issued":
      return "bg-green-900/20 text-green-600";
    case "checked_in":
      return "bg-blue-900/20 text-blue-600";
    case "cancelled":
      return "bg-red-900/20 text-red-500";
    default:
      return "bg-surface text-muted-foreground";
  }
}

function ticketStatusLabel(status: string): string {
  switch (status) {
    case "issued":
      return "Issued";
    case "checked_in":
      return "Checked in";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export default function TicketsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    async function load() {
      setLoading(true);
      const res = await fetch("/api/tickets");
      if (!res.ok) {
        setError("Failed to load tickets");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTickets(data);
      setLoading(false);
    }
    load();
  }, [isLoaded, isSignedIn, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Present the QR code at the event for check-in.</p>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center">
            <span className="material-symbols-rounded text-4xl text-muted-foreground/50">confirmation_number</span>
            <h3 className="mt-4 text-sm font-semibold text-foreground">No tickets yet</h3>
            <p className="mt-1 text-xs text-muted-foreground">Register for an event to get your ticket.</p>
            <button
              onClick={() => router.push("/events")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-rounded text-sm">event</span>
              Browse events
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.payment_id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);

  useEffect(() => {
    async function load() {
      setQrLoading(true);
      const res = await fetch(`/api/tickets/${ticket.payment_id}`);
      if (res.ok) {
        const data = await res.json();
        setQrUrl(data.qr_data_url);
        const p = data.PAYMENTS;
        setPayment(Array.isArray(p) ? (p[0] ?? null) : p);
      }
      setQrLoading(false);
    }
    load();
  }, [ticket.payment_id]);

  const venue = ticket.EVENTS.venue_address
    ? `${ticket.EVENTS.venue_name}, ${ticket.EVENTS.venue_address}`
    : ticket.EVENTS.venue_name;

  const price =
    ticket.EVENTS.price > 0
      ? `${ticket.EVENTS.currency} ${ticket.EVENTS.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      : null;

  const paidTime = payment?.paid_at
    ? new Date(payment.paid_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border bg-white shadow-[0_4px_20px_rgba(0,0,0,.06)]">
      {/* Left: Event details */}
      <div className="flex flex-1 flex-col">
        {/* Gradient header strip */}
        <div className="relative bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300 px-8 py-5">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
          <div className="relative flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="material-symbols-rounded text-[16px]">confirmation_number</span>
              Ticket
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${ticketStatusStyle(ticket.status)}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {ticketStatusLabel(ticket.status)}
            </span>
          </div>
          <h2 className="relative mt-3 text-2xl font-bold text-white">{ticket.EVENTS.title}</h2>
        </div>

        {/* Details */}
        <div className="flex-1 px-8 py-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[22px] text-[#3db9ee]">calendar_today</span>
              <span className="text-base text-foreground">{formatEventDate(ticket.EVENTS.event_date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[22px] text-[#3db9ee]">schedule</span>
              <span className="text-base text-foreground">
                {formatTime(ticket.EVENTS.start_time)} – {formatTime(ticket.EVENTS.end_time)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[22px] text-[#3db9ee]">location_on</span>
              <span className="text-base text-foreground">{venue}</span>
            </div>
            {price && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-[22px] text-[#3db9ee]">payments</span>
                <span className="text-base font-semibold text-foreground">{price}</span>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Payment #{ticket.payment_id}</span>
              <span>Issued {new Date(ticket.issued_at).toLocaleDateString()}</span>
              {paidTime && <span>Paid {paidTime}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Dashed separator */}
      <div className="hidden w-px self-stretch bg-[linear-gradient(to_bottom,transparent_8px,_#d0d5dd_8px,_#d0d5dd_12px,transparent_12px)] bg-[length:1px_20px] sm:block" />

      {/* Right: QR Code */}
      <div className="flex w-64 shrink-0 items-center justify-center border-l border-dashed border-[#d0d5dd] bg-[#f9fafb] p-8">
        {qrLoading ? (
          <div className="grid size-48 place-items-center">
            <span className="material-symbols-rounded animate-pulse text-5xl text-muted-foreground/50">qr_code</span>
          </div>
        ) : qrUrl ? (
          <img src={qrUrl} alt="QR Code" className="size-48 rounded-lg" />
        ) : (
          <div className="grid size-48 place-items-center rounded-lg bg-surface">
            <span className="text-sm text-muted-foreground">No QR</span>
          </div>
        )}
      </div>
    </div>
  );
}
