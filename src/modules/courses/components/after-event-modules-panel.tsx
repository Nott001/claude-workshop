"use client";

import { Button } from "@/shared/components/button";
import { SectionCard } from "@/shared/components/section-card";
import { formatTime } from "@/shared/lib/date-utils";
import { useAfterEventModules } from "@/modules/courses/lib/use-after-event-modules";

/**
 * Which parts of this event's curriculum are kept back for afterwards.
 *
 * Sits beside the course panel because the two answer the same question from
 * opposite ends: that one is what happens in the room, this is which of it the
 * audience only gets once the room has closed.
 */
export function AfterEventModulesPanel({ eventId }: { eventId: string }) {
  const { modules, selected, dirty, saving, loading, error, toggle, save } = useAfterEventModules(eventId);

  return (
    <SectionCard
      title="Released after this event"
      icon="lock_clock"
      description="These modules stay hidden during the session and open to ticket holders the moment the event ends."
      actions={
        dirty ? (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-sm text-muted-fg">Loading modules...</p>
      ) : modules.length === 0 ? (
        <p className="text-sm text-muted-fg">This event&apos;s course has no modules to hold back yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {modules.map((mod) => (
            <li key={mod.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:border-brand">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-brand"
                  checked={selected.includes(mod.id)}
                  onChange={() => toggle(mod.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg">{mod.module_name}</span>
                  <span className="block truncate text-xs text-muted-fg">
                    {mod.start_time && mod.end_time
                      ? `Scheduled ${formatTime(mod.start_time)} – ${formatTime(mod.end_time)}`
                      : "No session time set"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </SectionCard>
  );
}
