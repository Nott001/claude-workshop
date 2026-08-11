"use client";

import { useEffect, useState } from "react";

const SHARE_BUTTON = "grid size-11 place-items-center rounded-full bg-muted transition hover:bg-brand hover:text-white";

function currentUrl() {
  return window.location.href;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

export function EventShare() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  function shareTo(endpoint: string) {
    window.open(endpoint, "_blank", "noopener");
  }

  async function copyLink() {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(currentUrl());
      setCopied(true);
    } catch {
      // Clipboard denied — stay silent rather than surface an error for an
      // optional nicety.
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)]">
      <div className="mb-4 flex items-center gap-2.5 border-b border-border pb-3">
        <div className="rounded-lg bg-info/10 p-2">
          <span className="material-symbols-rounded text-[20px] text-brand">share</span>
        </div>
        <span className="text-xs font-bold tracking-[0.1em] text-fg uppercase">Share event</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Share on Facebook"
          className={SHARE_BUTTON}
          onClick={() => shareTo(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl())}`)}
        >
          <FacebookIcon />
        </button>
        <button
          type="button"
          aria-label="Share on LinkedIn"
          className={SHARE_BUTTON}
          onClick={() => shareTo(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl())}`)}
        >
          <LinkedInIcon />
        </button>
        <button type="button" aria-label="Copy link" className={SHARE_BUTTON} onClick={copyLink}>
          <span className="material-symbols-rounded text-base">link</span>
        </button>
      </div>
      {copied && (
        <p className="mt-2 flex items-center gap-1 text-xs text-fg">
          <span className="material-symbols-rounded text-sm text-brand">check_circle</span>
          Copied
        </p>
      )}
    </div>
  );
}
