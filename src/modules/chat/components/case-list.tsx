"use client";

import { Badge } from "@/shared/components/badge";
import type { CaseSummary } from "@/modules/chat/lib/use-support-cases";

interface CaseListProps {
  cases: CaseSummary[];
  loading: boolean;
  selectedId: number | null;
  currentUserId: number | null;
  onSelect: (c: CaseSummary) => void;
}

export function CaseList({ cases, loading, selectedId, currentUserId, onSelect }: CaseListProps) {
  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
      {loading ? (
        <p className="p-4 text-sm text-muted-fg">Loading cases...</p>
      ) : cases.length === 0 ? (
        <p className="p-4 text-sm text-muted-fg">No open cases right now.</p>
      ) : (
        <ul>
          {cases.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c)}
                className={
                  "block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 " +
                  (selectedId === c.id ? "bg-muted" : "")
                }
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-fg">CASE-{c.case_number}</span>
                  {c.assigned_to === null ? (
                    <Badge variant="warning">Unclaimed</Badge>
                  ) : c.assigned_to === currentUserId ? (
                    <Badge variant="success">You</Badge>
                  ) : (
                    <Badge>{c.assigned_name}</Badge>
                  )}
                </div>
                <div className="truncate text-sm font-medium text-fg">{c.full_name}</div>
                <div className="truncate text-xs text-muted-fg">{c.last_message ?? "No messages yet"}</div>
                {c.last_message_at && (
                  <div className="mt-0.5 text-[10px] text-muted-fg">{new Date(c.last_message_at).toLocaleString()}</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
