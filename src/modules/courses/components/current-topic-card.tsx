"use client";

import { ModuleScheduleBadge } from "@/modules/courses/components/module-schedule-badge";
import type { CurrentTopic } from "@/modules/courses/lib/current-topic";

interface CurrentTopicCardProps {
  topic: CurrentTopic | null;
  isStaff: boolean;
  settingHighlight: boolean;
  onClearHighlight: () => void;
  showDescription?: boolean;
}

export function CurrentTopicCard({
  topic,
  isStaff,
  settingHighlight,
  onClearHighlight,
  showDescription = false,
}: CurrentTopicCardProps) {
  return (
    <div className="rounded-xl border-2 border-brand/30 bg-brand/5 p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <span className="material-symbols-rounded text-[16px] text-brand">podcasts</span>
        <span className="text-xs font-bold uppercase tracking-wide text-brand">Current topic</span>
      </div>

      {topic ? (
        <div className="mt-3">
          <h3 className="text-lg font-bold text-fg">{topic.lesson.name}</h3>
          {showDescription && topic.lesson.description && (
            <p className="mt-1 text-sm text-muted-fg">{topic.lesson.description}</p>
          )}
          <div className="mt-1">
            <ModuleScheduleBadge startTime={topic.startTime} endTime={topic.endTime} speakerName={topic.speakerName} />
          </div>
          {isStaff && (
            <button
              onClick={onClearHighlight}
              disabled={settingHighlight}
              className="mt-3 rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-fg transition-colors hover:bg-brand/10 hover:text-brand"
            >
              Clear highlight
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-fg">No lesson is being highlighted right now.</p>
          {isStaff && <p className="mt-1 text-xs text-muted-fg">Pick a lesson below to point everyone to it.</p>}
        </div>
      )}
    </div>
  );
}
