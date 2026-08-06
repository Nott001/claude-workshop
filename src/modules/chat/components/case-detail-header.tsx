"use client";

import { Badge } from "@/shared/components/badge";
import { Button } from "@/shared/components/button";
import type { CaseSummary } from "@/modules/chat/lib/use-support-cases";

interface CaseDetailHeaderProps {
  caseRow: CaseSummary;
  isOwner: boolean;
  isUnclaimed: boolean;
  currentUserId: number | null;
  acting: boolean;
  onClaim: () => void;
  onRelinquish: () => void;
  onEnd: () => void;
}

export function CaseDetailHeader({
  caseRow,
  isOwner,
  isUnclaimed,
  currentUserId,
  acting,
  onClaim,
  onRelinquish,
  onEnd,
}: CaseDetailHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-fg">CASE-{caseRow.case_number}</span>
          <Badge variant={isUnclaimed ? "warning" : isOwner ? "success" : "default"}>
            {isUnclaimed ? "Unclaimed" : isOwner ? "Handling" : caseRow.assigned_name}
          </Badge>
        </div>
        <div className="truncate text-sm text-muted-fg">{caseRow.full_name}</div>
      </div>
      <div className="flex shrink-0 gap-2">
        {isUnclaimed && currentUserId != null && (
          <Button size="sm" onClick={onClaim} disabled={acting}>
            {acting ? "Claiming..." : "Claim case"}
          </Button>
        )}
        {isOwner && (
          <>
            <Button size="sm" variant="secondary" onClick={onRelinquish} disabled={acting}>
              Relinquish
            </Button>
            <Button size="sm" variant="danger" onClick={onEnd} disabled={acting}>
              End case
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
