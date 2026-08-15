"use client";

import { Button } from "@/shared/components/button";
import { cn } from "@/shared/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={cn("mt-6 flex items-center justify-center gap-3", className)}>
      <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <span aria-hidden className="material-symbols-rounded text-sm">
          chevron_left
        </span>
        Previous
      </Button>
      <span className="text-sm text-muted-fg">
        {start}–{end} of {total}
      </span>
      <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
        <span aria-hidden className="material-symbols-rounded text-sm">
          chevron_right
        </span>
      </Button>
    </div>
  );
}

export { Pagination };
