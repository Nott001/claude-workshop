"use client";

import { useState } from "react";
import { Button } from "@/shared/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/dialog";
import { buildGoogleCalendarUrl, buildIcsHref, buildOutlookCalendarUrl } from "@/shared/lib/calendar-links";
import { formatVenue } from "@/shared/lib/event-format";

interface AddToCalendarProps {
  event: {
    title: string;
    description?: string | null;
    venue_name: string | null | undefined;
    venue_address: string | null | undefined;
    event_date: string;
    start_time: string;
    end_time: string;
  };
}

const OPTION_ROW = "border border-border rounded-xl px-4 py-3 hover:bg-muted";

export function AddToCalendar({ event }: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);

  const data = {
    title: event.title,
    description: event.description,
    location: formatVenue(event.venue_name, event.venue_address),
    date: event.event_date,
    startTime: event.start_time,
    endTime: event.end_time,
  };

  function choose(provider: string) {
    setAddedTo(provider);
    setOpen(false);
  }

  return (
    <div>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <span className="material-symbols-rounded">calendar_plus</span>
        Add to Calendar
      </Button>
      {addedTo && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-fg">
          <span className="material-symbols-rounded text-base text-brand">check_circle</span>
          Added to {addedTo}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to calendar</DialogTitle>
            <DialogDescription>Choose where you&apos;d like to add this event.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-label="Google Calendar"
              className={OPTION_ROW}
              onClick={() => {
                window.open(buildGoogleCalendarUrl(data), "_blank", "noopener");
                choose("Google Calendar");
              }}
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-rounded text-brand">calendar_month</span>
                Google Calendar
              </span>
            </button>
            <button
              type="button"
              aria-label="Outlook Calendar"
              className={OPTION_ROW}
              onClick={() => {
                window.open(buildOutlookCalendarUrl(data), "_blank", "noopener");
                choose("Outlook Calendar");
              }}
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-rounded text-brand">mail</span>
                Outlook Calendar
              </span>
            </button>
            <a
              href={buildIcsHref(data)}
              download
              aria-label="Apple Calendar / Download .ics"
              className={OPTION_ROW}
              onClick={() => choose("Apple Calendar")}
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-rounded text-brand">download</span>
                Apple Calendar / Download .ics
              </span>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
