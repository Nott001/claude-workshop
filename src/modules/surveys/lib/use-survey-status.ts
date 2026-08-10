"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/lib/fetcher";
import type { StaffSurveyStatus } from "@/modules/surveys/lib/survey-service";

/** Staff survey status for one event; only fetched once the event opts in. */
export function useSurveyStatus(eventId: string, enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<StaffSurveyStatus>(
    enabled ? `/api/events/${eventId}/survey` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  return {
    status: data ?? null,
    loading: enabled && isLoading,
    error: error ? "Failed to load survey" : null,
    mutate,
  };
}
