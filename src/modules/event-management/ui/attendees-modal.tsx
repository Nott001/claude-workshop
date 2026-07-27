"use client";

import { AttendeesPanel } from "@/components/attendees-panel";

export function AttendeesModal({ show, eventId, onClose }: { show: boolean; eventId: string; onClose: () => void }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-8">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-bold text-fg">Attendees</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <span className="material-symbols-rounded text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <AttendeesPanel eventId={eventId} />
        </div>
      </div>
    </div>
  );
}
