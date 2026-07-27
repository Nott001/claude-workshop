"use client";

import { Footer } from "@/components/footer";
import { KioskEventSelector } from "@/modules/kiosk/ui/kiosk-event-selector";
import { KioskScannerView } from "@/modules/kiosk/ui/kiosk-scanner-view";
import { useKiosk } from "@/modules/kiosk/lib/use-kiosk";

export default function KioskPage() {
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
        <KioskEventSelector events={events} eventsLoading={eventsLoading} error={eventsError} onSelect={setSelectedEvent} />
      ) : (
        <KioskScannerView selectedEvent={selectedEvent} onChangeEvent={() => setSelectedEvent(null)} />
      )}

      <Footer role="facilitator" />
    </div>
  );
}
