import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { eventModeIcon } from "@/shared/lib/event-format";
import { EventStatusBadge } from "@/modules/events/components/event-status-badge";
import { CardCta } from "@/shared/components/card-cta";
import { CardLink } from "@/shared/components/card-link";
import type { CSSProperties } from "react";
import type { EventMode } from "@/shared/types";

const ACCENT_CLASSES = [
  "from-sky-500 via-cyan-400 to-teal-300",
  "from-blue-700 via-sky-500 to-cyan-300",
  "from-indigo-600 via-blue-500 to-cyan-400",
  "from-sky-600 via-cyan-500 to-emerald-400",
];

function accentClass(index: number): string {
  return ACCENT_CLASSES[index % ACCENT_CLASSES.length];
}

interface EventCardProps {
  eventId: number;
  title: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  /** Decides the venue row's icon. `venueName` is the platform when online. */
  eventType?: EventMode | null;
  coverImageUrl?: string | null;
  accentIndex?: number;
  showEdit?: boolean;
  onDelete?: (eventId: number) => void;
  detailHref?: string;
  /** Merged onto the card shell, for the grid to hand a card its entry animation. */
  className?: string;
  /** Carries that animation's per-card delay, which has to be a computed value. */
  style?: CSSProperties;
}

export function EventCard({
  eventId,
  title,
  status,
  date,
  startTime,
  endTime,
  venueName,
  eventType,
  coverImageUrl,
  accentIndex = 0,
  showEdit,
  onDelete,
  detailHref,
  className,
  style,
}: EventCardProps) {
  return (
    <CardLink href={detailHref ?? `/events/${eventId}`} className={className} style={style}>
      <article>
        <div className="relative h-48 overflow-hidden p-6 text-white">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${accentClass(accentIndex)} transition-transform duration-300 ease-in-out motion-safe:group-hover:scale-105`}
          />
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt={title}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-in-out motion-safe:group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {!coverImageUrl && (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
          )}
          <EventStatusBadge status={status} date={date} startTime={startTime} endTime={endTime} />
        </div>
        <div className="p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h3>
          <div className="mt-4 space-y-2 text-sm text-muted-fg">
            <p className="flex items-center gap-2">
              <span className="material-symbols-rounded text-base text-brand">calendar_today</span> {formatEventDate(date)}
            </p>
            <p className="flex items-center gap-2">
              <span className="material-symbols-rounded text-base text-brand">schedule</span> {formatTime(startTime)} –{" "}
              {formatTime(endTime)}
            </p>
            <p className="flex items-center gap-2">
              {/* The mode is carried by the icon alone, which a screen reader
                  would otherwise read out as the ligature text "videocam". */}
              <span aria-hidden className="material-symbols-rounded text-base text-brand">
                {eventModeIcon(eventType)}
              </span>
              <span className="sr-only">{eventType === "online" ? "Online:" : "Venue:"}</span>
              <span>{venueName}</span>
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <CardCta>View details</CardCta>
            {showEdit && onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm("Delete this event? This cannot be undone.")) onDelete(eventId);
                }}
                className="text-xs font-medium text-error transition-colors hover:text-error"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </article>
    </CardLink>
  );
}
