"use client";

interface SupportUser {
  id: number;
  full_name: string;
  last_message: string;
  last_sent_at: string;
  unread: boolean;
  session_active: boolean;
}

interface SupportChatHeaderProps {
  user: SupportUser | undefined;
  sessionActive: boolean;
  endingChat: boolean;
  deletingChat: boolean;
  onEndChat: () => void;
  onDeleteChat: () => void;
}

export function SupportChatHeader({
  user,
  sessionActive,
  endingChat,
  deletingChat,
  onEndChat,
  onDeleteChat,
}: SupportChatHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">
          {user?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-fg">{user?.full_name ?? "Unknown"}</span>
          {sessionActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(0,150,199,0.1)] px-2 py-0.5 text-[10px] font-semibold text-brand">
              <span className="size-1.5 rounded-full bg-brand" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(139,152,158,0.1)] px-2 py-0.5 text-[10px] font-semibold text-muted-fg">
              Ended
            </span>
          )}
        </div>
      </div>
      {sessionActive && (
        <button
          onClick={onEndChat}
          disabled={endingChat}
          className="flex items-center gap-1 rounded-lg border border-error/30 px-2.5 py-1.5 text-[10px] font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
        >
          <span className="material-symbols-rounded text-xs">call_end</span>
          End Chat
        </button>
      )}
      {!sessionActive && (
        <button
          onClick={onDeleteChat}
          disabled={deletingChat}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-bold text-muted-fg transition-colors hover:border-error/30 hover:text-error disabled:opacity-50"
        >
          <span className="material-symbols-rounded text-xs">delete</span>
          Delete
        </button>
      )}
    </div>
  );
}
