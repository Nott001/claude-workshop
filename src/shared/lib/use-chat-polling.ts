"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { fetcher } from "./fetcher";

export function useChatPolling<T>(url: string) {
  const pollIntervalRef = useRef(5000);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevLastMsgRef = useRef(0);

  function setActive() {
    pollIntervalRef.current = 2000;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      pollIntervalRef.current = 5000;
    }, 30000);
  }

  const { data, isLoading } = useSWR<T>(url, fetcher, {
    refreshInterval: () => pollIntervalRef.current,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    const messages = (data as { messages?: { id: number }[] })?.messages;
    if (messages?.length) {
      const last = messages[messages.length - 1];
      if (last.id !== prevLastMsgRef.current) {
        prevLastMsgRef.current = last.id;
        setActive();
      }
    }
  }, [data]);

  return { data, isLoading, setActive };
}
