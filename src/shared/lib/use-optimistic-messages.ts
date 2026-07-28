"use client";

import { useState, useMemo } from "react";

export function useOptimisticMessages<T extends { id: number }>(serverMessages: T[]) {
  const [pending, setPending] = useState<T[]>([]);

  const all = useMemo(() => {
    const merged = [...serverMessages];
    for (const p of pending) {
      if (!merged.some((m) => m.id === p.id)) {
        merged.push(p);
      }
    }
    return merged;
  }, [serverMessages, pending]);

  function addOptimistic(msg: T) {
    setPending((prev) => [...prev, msg]);
  }

  function resolveOptimistic(id: number) {
    setPending((prev) => prev.filter((m) => m.id !== id));
  }

  return { all, pending, addOptimistic, resolveOptimistic };
}
