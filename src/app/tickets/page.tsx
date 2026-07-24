"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  event_id: number;
  qr_token: string;
  status: string;
  issued_at: string;
  PAYMENTS: PaymentInfo | PaymentInfo[];
  EVENTS: TicketEvent;
}

function ticketStatusStyle(status: string): string {
  switch (status) {
    case "checked_in":
      return "bg-green-50 text-green-700";
    case "issued":
      return "bg-blue-50 text-blue-700";
    case "cancelled":
      return "bg-gray-50 text-gray-500";
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
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
            <span className="material-symbols-rounded text-2xl text-[#3db9ee]">confirmation_number</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1B1C1C]">My Tickets</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Present the QR code at the event for check-in.</p>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#bdc8d0] bg-[#f9fafb] p-12 text-center">
            <span className="material-symbols-rounded text-4xl text-muted-foreground/50">confirmation_number</span>
            <h3 className="mt-4 text-sm font-semibold text-[#1B1C1C]">No tickets yet</h3>
            <p className="mt-1 text-xs text-[#6E7980]">Register for an event to get your ticket.</p>
            <button
              onClick={() => router.push("/events")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#29B6F6] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#039be5]"
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
    <div className="flex overflow-hidden rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]">
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
              <span className="material-symbols-rounded text-[20px] text-[#3db9ee]">calendar_today</span>
              <span className="text-sm text-[#1B1C1C]">{formatEventDate(ticket.EVENTS.event_date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[20px] text-[#3db9ee]">schedule</span>
              <span className="text-sm text-[#1B1C1C]">
                {formatTime(ticket.EVENTS.start_time)} &ndash; {formatTime(ticket.EVENTS.end_time)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-[20px] text-[#3db9ee]">location_on</span>
              <span className="text-sm text-[#1B1C1C]">{venue}</span>
            </div>
            {price && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-[20px] text-[#3db9ee]">payments</span>
                <span className="text-sm font-semibold text-[#1B1C1C]">{price}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Link
              href={`/events/${ticket.event_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#29B6F6] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#039be5]"
            >
              Go to event
              <span className="material-symbols-rounded text-[14px]">arrow_forward</span>
            </Link>
          </div>

          <div className="mt-4 border-t border-[#bdc8d0] pt-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Payment #{ticket.payment_id}</span>
              <span>Issued {new Date(ticket.issued_at).toLocaleDateString()}</span>
              {paidTime && <span>Paid {paidTime}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden w-px self-stretch bg-[linear-gradient(to_bottom,transparent_8px,_#d0d5dd_8px,_#d0d5dd_12px,transparent_12px)] bg-[length:1px_20px] sm:block" />

      <div className="flex w-56 shrink-0 items-center justify-center border-l border-dashed border-[#d0d5dd] bg-[#f9fafb] p-6">
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
