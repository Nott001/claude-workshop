"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface Ticket {
  payment_id: number;
  qr_token: string;
  status: string;
  issued_at: string;
  qr_data_url: string;
  EVENTS: { title: string; event_date: string; venue_name: string };
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

  if (loading) return <div>Loading tickets...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>My Tickets</h1>

      {tickets.length === 0 ? (
        <p>No tickets yet.</p>
      ) : (
        <ul>
          {tickets.map((ticket) => (
            <li key={ticket.payment_id}>
              <h2>{ticket.EVENTS.title}</h2>
              <p>{ticket.EVENTS.event_date}</p>
              <p>{ticket.EVENTS.venue_name}</p>
              <p>Status: {ticket.status}</p>
              <p>Issued: {new Date(ticket.issued_at).toLocaleDateString()}</p>
              <TicketQR paymentId={ticket.payment_id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketQR({ paymentId }: { paymentId: number }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/tickets/${paymentId}`);
      if (res.ok) {
        const data = await res.json();
        setQrUrl(data.qr_data_url);
      }
    }
    load();
  }, [paymentId]);

  if (!qrUrl) return <p>Loading QR code...</p>;
  return <img src={qrUrl} alt="QR Code" />;
}
