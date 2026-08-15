"use client";

import type { MouseEvent } from "react";

import { platformFromUrl } from "@/modules/community/lib/community-platform";

interface CommunityCardProps {
  label: string;
  description: string | null;
  iconUrl: string | null;
  url: string;
  /** Ask the page to confirm the hand-off before the browser leaves. */
  onJoin: () => void;
}

/**
 * A middle-click, or a click held with a modifier, is the visitor asking the
 * browser for a new tab directly. Confirming that would be answering a question
 * they did not ask, so those fall through to the anchor's own behaviour.
 */
function opensInNewTabAlready(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function CommunityCard({ label, description, iconUrl, url, onJoin }: CommunityCardProps) {
  const platform = platformFromUrl(url);

  function handleJoin(event: MouseEvent<HTMLAnchorElement>) {
    if (opensInNewTabAlready(event)) return;
    event.preventDefault();
    onJoin();
  }

  // Deliberately inert: the join link is the only click target, so the card
  // carries a flat resting shadow and no hover lift. Lifting the whole card
  // would promise a click the card does not answer.
  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <span className="mb-4 grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand/10 text-brand">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden className="material-symbols-rounded">
            groups
          </span>
        )}
      </span>

      <h3 className="text-base font-bold tracking-[-0.01em] text-fg">{label}</h3>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted-fg">{description}</p>}

      {/* Pushed down rather than growing the paragraph, so cards with no
          description still line their call to action up with the rest. */}
      <div className="mt-auto pt-4">
        {platform && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-fg">
            <span aria-hidden className="material-symbols-rounded text-[14px]!">
              {platform.icon}
            </span>
            {platform.name}
          </span>
        )}
        {/* Still a real anchor with its href: the confirmation is layered over
            the link, not substituted for it, so hover preview, copy-link and
            assistive tech all keep working. */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleJoin}
          /* Every card's link reads "Join community", so the visible text alone
             leaves a screen reader unable to tell one from the next. */
          aria-label={`Join ${label}`}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 text-sm font-bold text-brand-fg transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Join community
          <span aria-hidden className="material-symbols-rounded text-base!">
            open_in_new
          </span>
        </a>
      </div>
    </article>
  );
}
