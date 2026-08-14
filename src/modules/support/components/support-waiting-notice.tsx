interface SupportWaitingNoticeProps {
  visible: boolean;
}

export function SupportWaitingNotice({ visible }: SupportWaitingNoticeProps) {
  if (!visible) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-info/5 px-4 py-2" role="status">
      <span className="material-symbols-rounded text-sm text-brand">hourglass_empty</span>
      <p className="text-[11px] text-muted-fg">Someone will pick up your case soon. Please wait for a response.</p>
    </div>
  );
}
