"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, MapPin } from "lucide-react";

import { formatEventDate } from "@/lib/landing";

interface TicketEvent {
  title: string;
  event_date: string;
  venue_name: string;
}

interface Ticket {
  payment_id: number;
  qr_token: string;
  status: string;
  issued_at: string;
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
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">View all your registered events and tickets.</p>
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

  useEffect(() => {
    async function load() {
      setQrLoading(true);
      const res = await fetch(`/api/tickets/${ticket.payment_id}`);
      if (res.ok) {
        const data = await res.json();
        setQrUrl(data.qr_data_url);
      }
      setQrLoading(false);
    }
    load();
  }, [ticket.payment_id]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <div className="relative bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300 p-5 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
              <span className="material-symbols-rounded text-[14px]">confirmation_number</span>
              Ticket
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ticketStatusStyle(ticket.status)}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {ticketStatusLabel(ticket.status)}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold">{ticket.EVENTS.title}</h3>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-blue-500" />
            {formatEventDate(ticket.EVENTS.event_date)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-blue-500" />
            {ticket.EVENTS.venue_name}
          </p>
          <p className="flex items-center gap-2">
            <span className="material-symbols-rounded text-sm text-blue-500">calendar_month</span>
            Issued {new Date(ticket.issued_at).toLocaleDateString()}
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          {qrLoading ? (
            <div className="grid size-32 place-items-center rounded-lg bg-surface">
              <span className="material-symbols-rounded animate-pulse text-muted-foreground">qr_code</span>
            </div>
          ) : qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="size-32 rounded-lg border border-border" />
          ) : (
            <div className="grid size-32 place-items-center rounded-lg bg-surface">
              <span className="text-xs text-muted-foreground">No QR</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
