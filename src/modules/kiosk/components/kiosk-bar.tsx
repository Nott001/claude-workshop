"use client";

/**
 * The kiosk's only bar. AppShell hides the app chrome on this route, so this
 * carries the exit the staff navbar would otherwise have provided.
 */
export function KioskBar({ eventTitle, onExit }: { eventTitle?: string | null; onExit: () => void }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-rounded text-[20px] text-brand">bolt</span>
        <span className="text-sm font-bold tracking-tight text-fg">StartupLab — Kiosk mode</span>
      </div>

      {eventTitle && (
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={eventTitle}>
          {eventTitle}
        </span>
      )}

      <button
        onClick={onExit}
        className="ml-auto flex items-center gap-2 text-sm font-medium tracking-[0.7px] text-muted-fg transition-colors hover:text-fg"
      >
        <span className="material-symbols-rounded text-base">logout</span>
        EXIT KIOSK
      </button>
    </div>
  );
}
