"use client";

import { Button } from "@/shared/components/button";

interface LoadMoreProps {
  loading: boolean;
  onLoadMore: () => void;
  label?: string;
}

export function LoadMoreButton({ loading, onLoadMore, label = "Load more" }: LoadMoreProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <span className="text-sm text-muted-fg">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-4">
      <Button type="button" variant="secondary" size="sm" onClick={onLoadMore}>
        {label}
      </Button>
    </div>
  );
}
