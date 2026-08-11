interface CommunityCardProps {
  label: string;
  description: string | null;
  iconUrl: string | null;
  url: string;
}

export function CommunityCard({ label, description, iconUrl, url }: CommunityCardProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,.05)] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,.12)]"
    >
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <span className="material-symbols-rounded text-2xl">groups</span>
          </span>
        )}
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{label}</h3>
      </div>

      {description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>}

      <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand">
        Visit group <span className="material-symbols-rounded text-base">open_in_new</span>
      </span>
    </a>
  );
}
