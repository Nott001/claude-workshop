import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface SectionCardProps {
  title: string;
  icon: string;
  /** Sub-label under the title, for a section whose purpose is not self-evident. */
  description?: string;
  /** Rendered opposite the title: the section's own control, where it has one. */
  actions?: ReactNode;
  /** Anchors the panel, so a link can point at one section of a long page. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The panel a staff detail section sits in.
 *
 * One definition, because the staff event page grew two identical ones — a
 * `SectionCard` for its read panels and a `FormSection` for its form — which
 * then drifted apart in padding and heading weight, and made a form embedded in
 * a panel look like a second page pasted into the first.
 */
export function SectionCard({ title, icon, description, actions, id, className, children }: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn("rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]", className)}
    >
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-info/10 p-2">
            <span aria-hidden className="material-symbols-rounded text-[20px] text-brand">
              {icon}
            </span>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-[0.1em] text-fg">{title.toUpperCase()}</h2>
            {description && <p className="mt-1 text-xs font-normal text-muted-fg">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** The stat tiles the overview and survey panels both show. */
export function StatGrid({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-muted p-3">
          <dd className="text-lg font-bold text-fg">{stat.value}</dd>
          <dt className="text-[10px] tracking-wide text-muted-fg uppercase">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
