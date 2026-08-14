"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` after it has been stable for `delayMs`. The timeout is
 * cleared on every change and on unmount, so a stale timer can never set state
 * for an unmounted component.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
