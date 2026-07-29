"use client";

import { Footer } from "@/shared/components/footer";
import { useKiosk } from "@/modules/kiosk/lib/use-kiosk";

export default function StaffKioskPage() {
  const { isLoaded, userRole, events, eventsLoading, eventsError, selectedEvent, setSelectedEvent } = useKiosk();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-4xl text-brand">progress_activity</span>
      </div>
    );
  }

  if (userRole !== "facilitator") return null;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-[20px] text-brand">bolt</span>
          <span className="text-sm font-bold tracking-tight text-fg">StartupLab — Kiosk mode</span>
        </div>
        {selectedEvent && (
          <div className="flex items-center gap-3">
            <span className="truncate max-w-[200px] text-sm font-medium text-fg">{selectedEvent.title}</span>
            <button
              onClick={() => setSelectedEvent(null)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-muted-fg transition hover:border-brand hover:text-brand"
            >
              <span className="material-symbols-rounded text-[14px]">swap_horiz</span>
              Change
            </button>
          </div>
        )}
      </div>

      {!selectedEvent ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          {eventsLoading ? (
            <p className="text-sm text-muted-fg">Loading events...</p>
          ) : eventsError ? (
            <p className="text-sm text-error">{eventsError}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-fg">No events available.</p>
          ) : (
            <div className="grid w-full max-w-2xl grid-cols-1 gap-3">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left transition hover:border-brand"
                >
                  <div>
                    <span className="text-sm font-semibold text-fg">{event.title}</span>
                    <span className="ml-3 text-xs text-muted-fg">{event.event_date}</span>
                  </div>
                  <span className="material-symbols-rounded text-[16px] text-muted-fg">arrow_forward</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <span className="material-symbols-rounded text-6xl text-brand">qr_code_scanner</span>
          <p className="mt-4 text-sm text-muted-fg">Scanner view coming soon.</p>
        </div>
      )}

      <Footer role="facilitator" />
    </div>
  );
}
