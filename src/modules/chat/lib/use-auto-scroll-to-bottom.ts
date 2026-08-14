"use client";

import { useEffect, useRef } from "react";
import { isNearBottom } from "./auto-scroll";

/**
 * Scrolls the owning container to the newest message. Sending always scrolls;
 * receiving only scrolls when the reader was already near the bottom, so a
 * sidetracked reader is not yanked to the end they have not read yet.
 */
export function useAutoScrollToBottom<T>(items: T[], enabled = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const forceRef = useRef(false);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const onScroll = () => {
      nearBottomRef.current = isNearBottom(el.scrollHeight, el.scrollTop, el.clientHeight);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const shouldScroll = forceRef.current || nearBottomRef.current;
    forceRef.current = false;
    if (shouldScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [items, enabled]);

  return {
    containerRef,
    bottomRef,
    forceScroll: () => {
      forceRef.current = true;
    },
  };
}
