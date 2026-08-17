/**
 * The card the course builder draws itself on. Shared so the empty state and
 * the populated curriculum are one continuous surface rather than two that
 * drifted apart, and so a host page never has to supply one of its own.
 */
export const BUILDER_SURFACE = "rounded-xl border border-border bg-surface p-8 shadow-[0_4px_20px_0_rgba(0,0,0,0.05)]";
