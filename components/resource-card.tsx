interface ResourceCardProps {
  title: string;
  type: "pdf" | "link" | "video";
  url?: string;
  size?: string;
  onDownload?: () => void;
  onOpen?: () => void;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: "description", color: "text-red-500" },
  link: { icon: "link", color: "text-blue-400" },
  video: { icon: "play_circle", color: "text-blue-400" },
};

export function ResourceCard({ title, type, size, onDownload, onOpen }: ResourceCardProps) {
  const { icon, color } = TYPE_ICONS[type] || TYPE_ICONS.pdf;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <span className={`material-symbols-rounded text-[26px] ${color}`}>{icon}</span>
      <div className="flex-1">
        <h4 className="text-[13.5px] font-semibold text-foreground">{title}</h4>
        {size && <div className="text-xs text-muted-foreground">{size}</div>}
      </div>
      {onDownload && (
        <button
          onClick={onDownload}
          className="rounded-md bg-surface p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          title="Download"
        >
          <span className="material-symbols-rounded text-sm">download</span>
        </button>
      )}
      {onOpen && (
        <button
          onClick={onOpen}
          className="rounded-md bg-surface p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          title="Open"
        >
          <span className="material-symbols-rounded text-sm">open_in_new</span>
        </button>
      )}
    </div>
  );
}
