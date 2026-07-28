import Link from "next/link";

import { formatEventDate, formatTime, isEventLive, eventStatusLabel } from "@/shared/lib/date-utils";

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
  coverImageUrl?: string | null;
  accentIndex?: number;
  showEdit?: boolean;
  onDelete?: (eventId: number) => void;
  detailHref?: string;
}

export function EventCard({
  eventId,
  title,
  status,
  date,
  startTime,
  endTime,
  venueName,
  coverImageUrl,
  accentIndex = 0,
  showEdit,
  onDelete,
  detailHref,
}: EventCardProps) {
  const live = isEventLive(date, startTime, endTime);

  return (
    <Link
      href={detailHref ?? `/events/${eventId}`}
      className="group block overflow-hidden rounded-xl border border-border bg-surface shadow-[0_4px_20px_rgba(0,0,0,.05)] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,.12)]"
    >
      <article>
        <div className="relative h-48 overflow-hidden p-6 text-white">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${accentClass(accentIndex)} transition-transform duration-300 ease-in-out group-hover:scale-105`}
          />
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt={title}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {!coverImageUrl && (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
          )}
          {live ? (
            <span className="relative inline-flex items-center gap-1.5 rounded-full bg-error px-3 py-1 text-xs font-semibold">
              <span className="size-1.5 rounded-full bg-surface animate-pulse" />
              Live
            </span>
          ) : (
            <span className="relative inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <span className="material-symbols-rounded text-sm">auto_awesome</span> {eventStatusLabel(status)}
            </span>
          )}
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
              <span className="material-symbols-rounded text-base text-brand">location_on</span> {venueName}
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
              View details <span className="material-symbols-rounded text-base">chevron_right</span>
            </span>
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
    </Link>
  );
}
