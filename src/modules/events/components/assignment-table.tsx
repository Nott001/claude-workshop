"use client";

import { LoadMoreButton } from "@/shared/components/load-more";

export interface AssignmentRow {
  id: number;
  name: string;
  /** Secondary line shown under the name, e.g. email or designation. */
  detail?: string;
}

interface AssignmentTableProps {
  loading?: boolean;
  assigned: AssignmentRow[];
  candidates: AssignmentRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  addButtonLabel: string;
  candidatePlaceholder: string;
  emptyLabel: string;
  allAssignedLabel: string;
  candidatesLoadingMore?: boolean;
  candidatesHasMore?: boolean;
  onLoadMoreCandidates?: () => void;
}

/**
 * The assigned-vs-available table every event assignment surface shares: a
 * roster of who is assigned (with a remove action) and a picker to add someone.
 * The add control is a button, not a nested <form>, so it can live inside the
 * create/edit event form without invalid nesting.
 */
export function AssignmentTable({
  loading = false,
  assigned,
  candidates,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  addButtonLabel,
  candidatePlaceholder,
  emptyLabel,
  allAssignedLabel,
  candidatesLoadingMore = false,
  candidatesHasMore = false,
  onLoadMoreCandidates,
}: AssignmentTableProps) {
  if (loading) {
    return <p className="text-sm text-muted-fg">Loading...</p>;
  }

  return (
    <div>
      {assigned.length === 0 ? (
        <p className="mb-4 text-sm text-muted-fg">{emptyLabel}</p>
      ) : (
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-bold tracking-[0.1em] text-muted-fg">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Details</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assigned.map((row) => (
              <tr key={row.id}>
                <td className="py-2.5 pr-3 font-medium text-fg">{row.name}</td>
                <td className="py-2.5 pr-3 text-muted-fg">{row.detail ?? "\u2014"}</td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    className="text-xs font-semibold text-error transition-colors hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {candidates.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
          >
            <option value="">{candidatePlaceholder}</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
                {candidate.detail ? ` \u2014 ${candidate.detail}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedId}
            onClick={onAdd}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
          >
            {addButtonLabel}
          </button>
        </div>
      ) : (
        assigned.length > 0 && <p className="text-xs text-muted-fg">{allAssignedLabel}</p>
      )}

      {candidatesHasMore && onLoadMoreCandidates && (
        <LoadMoreButton loading={candidatesLoadingMore} onLoadMore={onLoadMoreCandidates} label="Load more" />
      )}
    </div>
  );
}
