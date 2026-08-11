"use client";

import type { EventSpeakerProfile } from "@/modules/events/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/shared/components/dialog";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
}

const AVATAR_STYLES = "rounded-full object-cover";

function Avatar({ src, name, size }: { src: string | null; name: string; size: string }) {
  if (src) return <img src={src} alt={name} className={`${size} ${AVATAR_STYLES}`} />;
  return <span className={`${size} grid place-items-center rounded-full bg-muted font-bold`}>{initials(name)}</span>;
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const LINK_STYLES =
  "inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-fg transition hover:border-brand hover:text-brand";

export function EventSpeakerCard({ speaker }: { speaker: EventSpeakerProfile }) {
  const fullName = speaker.USER?.full_name ?? "Speaker";
  const designation = speaker.designation;

  const links: { url: string | null; label: string; icon: React.ReactNode }[] = [
    { url: speaker.website_url, label: "Website", icon: <span className="material-symbols-rounded text-base">public</span> },
    { url: speaker.linkedin_url, label: "LinkedIn", icon: <LinkedInIcon /> },
    { url: speaker.twitter_url, label: "X", icon: <XIcon /> },
    { url: speaker.github_url, label: "GitHub", icon: <GitHubIcon /> },
  ];

  return (
    <Dialog>
      <DialogTrigger className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:shadow-[0_4px_20px_rgba(0,0,0,.08)]">
        <Avatar src={speaker.USER?.profile_image_url ?? null} name={fullName} size="size-20" />
        <span>
          <span className="block font-bold">{fullName}</span>
          {designation && <span className="block text-sm text-brand font-semibold">{designation}</span>}
        </span>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar src={speaker.USER?.profile_image_url ?? null} name={fullName} size="size-24" />
          <DialogTitle className="text-lg font-bold">{fullName}</DialogTitle>
          <DialogDescription className="text-sm font-semibold text-brand">{designation ?? "Speaker profile"}</DialogDescription>
          {speaker.bio && <p className="text-sm leading-relaxed text-muted-fg">{speaker.bio}</p>}
          <div className="mt-2 flex gap-2">
            {links.map(
              (link) =>
                link.url && (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener"
                    aria-label={link.label}
                    className={LINK_STYLES}
                  >
                    {link.icon}
                  </a>
                ),
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
