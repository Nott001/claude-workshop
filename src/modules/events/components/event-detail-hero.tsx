import { formatEventDate, formatTime } from "@/shared/lib/date-utils";
import { formatDuration } from "@/shared/lib/event-format";
import type { EventWithCourse } from "@/modules/events/lib/types";

interface EventDetailHeroProps {
  event: Pick<EventWithCourse, "title" | "event_date" | "start_time" | "end_time" | "cover_image_url" | "status">;
  badgeLabel: string;
}

export function EventDetailHero({ event, badgeLabel }: EventDetailHeroProps) {
  const duration = formatDuration(event.start_time, event.end_time);

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-xl shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-cyan-400 to-teal-300" />
      {event.cover_image_url && (
        <img src={event.cover_image_url} alt={event.title} className="absolute inset-0 size-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {!event.cover_image_url && (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
      )}
      <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-white/20 bg-black/30 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
        {badgeLabel}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{event.title}</h1>
        <p className="mt-1 text-sm text-white/90">
          {formatEventDate(event.event_date)} · {formatTime(event.start_time)} – {formatTime(event.end_time)}
          {duration ? ` · ${duration}` : ""}
        </p>
      </div>
    </div>
  );
}
