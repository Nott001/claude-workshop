"use client";

interface SupportUser {
  id: number;
  full_name: string;
  last_message: string;
  last_sent_at: string;
  unread: boolean;
  session_active: boolean;
}

interface SupportUserListProps {
  users: SupportUser[];
  selectedUserId: number | null;
  loading: boolean;
  onSelectUser: (userId: number) => void;
}

function formatUserTime(sentAt: string) {
  const d = new Date(sentAt);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function SupportUserList({ users, selectedUserId, loading, onSelectUser }: SupportUserListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center p-4">
          <div className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <p className="p-4 text-center text-xs text-muted-fg">No support requests yet.</p>
      ) : (
        users.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user.id)}
            className={
              "flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted " +
              (selectedUserId === user.id ? "bg-brand/10" : "")
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-fg">{user.full_name}</span>
                {user.session_active ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-brand" title="Active" />
                ) : (
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-fg" title="Ended" />
                )}
              </div>
              <span className="shrink-0 text-[10px] text-muted-fg">{formatUserTime(user.last_sent_at)}</span>
            </div>
            <span className="truncate text-[11px] text-muted-fg">{user.last_message}</span>
          </button>
        ))
      )}
    </div>
  );
}
