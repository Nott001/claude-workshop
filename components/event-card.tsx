import Link from "next/link";
import { StatusBadge, type EventStatus } from "@/components/status-badge";

interface EventCardProps {
  eventId: number;
  title: string;
  status: EventStatus;
  date: string;
  time?: string;
  description?: string;
  attendeeCount?: number;
  courseName?: string;
  actionLabel?: string;
  actionHref?: string;
  showEdit?: boolean;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventCard({
  eventId,
  title,
  status,
  date,
  time,
  description,
  attendeeCount,
  courseName,
  actionLabel,
  actionHref,
  showEdit,
}: EventCardProps) {
  const href = actionHref || `/events/${eventId}`;
  const label = actionLabel || (showEdit && status === "draft" ? "Edit" : "View details");

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4">
      <StatusBadge status={status} className="self-start" />
      <h4 className="text-[15px] font-semibold text-foreground">{title}</h4>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="material-symbols-rounded text-[15px]">calendar_today</span>
        {formatDate(date)}
        {time && ` · ${time}`}
      </div>
      {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {courseName && <div className="text-xs text-muted-foreground">Course: {courseName}</div>}
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        {attendeeCount !== undefined && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="material-symbols-rounded text-[15px]">group</span>
            {attendeeCount.toLocaleString()} registered
          </span>
        )}
        {!attendeeCount && <span />}
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80"
        >
          {label}
          <span className="material-symbols-rounded text-[15px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
