"use client";

import { useState } from "react";
import { SectionCard } from "@/shared/components/section-card";
import { FormField, FormLabel, FormDescription, FormMessage } from "@/shared/components/form";
import { Input } from "@/shared/components/input";
import { Button } from "@/shared/components/button";

interface MeetingLinkPanelProps {
  eventId: string;
  initialUrl: string | null | undefined;
  onSaved?: (meetingUrl: string | null) => void;
}

/**
 * Setting an online event's joining link, on the Overview tab where every staff
 * member can reach it.
 *
 * Its own panel and its own endpoint rather than a field on the edit form,
 * because the edit form is admin-only and the link is made on the day by
 * whoever is running the session. Emptying the box clears the link.
 */
export function MeetingLinkPanel({ eventId, initialUrl, onSaved }: MeetingLinkPanelProps) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState<string | null>(initialUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== (saved ?? "").trim();

  async function save() {
    setSaving(true);
    setError(null);

    const meetingUrl = value.trim() || null;
    const res = await fetch(`/api/events/${eventId}/meeting-link`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_url: meetingUrl }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      // The route answers 403/404 flat and everything else nested, the same as
      // the event routes it sits beside.
      setError(typeof body?.error === "string" ? body.error : (body?.error?.message ?? "Failed to save the meeting link"));
      setSaving(false);
      return;
    }

    setSaved(meetingUrl ?? "");
    setSaving(false);
    onSaved?.(meetingUrl);
  }

  return (
    <SectionCard title="Meeting link" icon="videocam" description="Where attendees join this online event.">
      <FormField>
        <FormLabel htmlFor="meeting-link">Link</FormLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="meeting-link"
            type="url"
            inputMode="url"
            placeholder="https://meet.google.com/..."
            className="min-w-64 flex-1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save link"}
          </Button>
        </div>
        {error ? (
          <FormMessage>{error}</FormMessage>
        ) : (
          <FormDescription className="text-xs">
            Attendees see it only once the event starts. Leave it empty to remove the link.
          </FormDescription>
        )}
      </FormField>
    </SectionCard>
  );
}
