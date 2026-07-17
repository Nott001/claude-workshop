import Link from "next/link";
import { CalendarDays, ChevronRight, Clock3, MapPin, Sparkles } from "lucide-react";

import { accentClass, formatEventDate, formatTime, eventStatusLabel } from "@/lib/landing";

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
  return (
    <article className="overflow-hidden rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <div className="relative h-48 overflow-hidden p-6 text-white">
        <div className={`absolute inset-0 bg-gradient-to-br ${accentClass(accentIndex)}`} />
        {coverImageUrl && <img src={coverImageUrl} alt={title} className="absolute inset-0 size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        {!coverImageUrl && (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
        )}
        <span className="relative inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
          <Sparkles className="size-3.5" /> {eventStatusLabel(status)}
        </span>
      </div>
      <div className="p-6">
        <h3 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h3>
        <div className="mt-4 space-y-2 text-sm text-[#526069]">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[#3db9ee]" /> {formatEventDate(date)}
          </p>
          <p className="flex items-center gap-2">
            <Clock3 className="size-4 text-[#3db9ee]" /> {formatTime(startTime)} – {formatTime(endTime)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-[#3db9ee]" /> {venueName}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <Link
            href={detailHref ?? `/events/${eventId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#168cb9] hover:underline"
          >
            View details <ChevronRight className="size-4" />
          </Link>
          {showEdit && onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                if (confirm("Delete this event? This cannot be undone.")) onDelete(eventId);
              }}
              className="text-xs font-medium text-red-500 transition-colors hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
