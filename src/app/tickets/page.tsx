"use client";

import { useRouter } from "next/navigation";

import { useTickets } from "@/modules/commerce/lib/use-tickets";
import { TicketCard } from "@/modules/commerce/components/ticket-card";
import { LoadMoreButton } from "@/shared/components/load-more";

export default function TicketsPage() {
  const router = useRouter();
  const { tickets, loading, loadingMore, error, hasMore, loadMore } = useTickets();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-fg">Loading tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,101,141,0.1)]">
            <span className="material-symbols-rounded text-2xl text-brand">confirmation_number</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">My Tickets</h1>
            <p className="mt-0.5 text-sm text-muted-fg">Present the QR code at the event for check-in.</p>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted p-12 text-center">
            <span className="material-symbols-rounded text-4xl text-muted-fg/50">confirmation_number</span>
            <h3 className="mt-4 text-sm font-semibold text-fg">No tickets yet</h3>
            <p className="mt-1 text-xs text-muted-fg">Register for an event to get your ticket.</p>
            <button
              onClick={() => router.push("/events")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand/80"
            >
              <span className="material-symbols-rounded text-sm">event</span>
              Browse events
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
        {hasMore && <LoadMoreButton loading={loadingMore} onLoadMore={loadMore} />}
      </div>
    </div>
  );
}
